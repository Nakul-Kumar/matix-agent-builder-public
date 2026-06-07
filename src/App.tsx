import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AppShell } from "./components/AppShell";
import { BackendBanner } from "./components/BackendBanner";
import { ExamplePromptRail } from "./components/ExamplePromptRail";
import { FeedbackForm } from "./components/FeedbackForm";
import { HeroSection } from "./components/HeroSection";
import { PromptComposer } from "./components/PromptComposer";
import { ResultsView } from "./components/ResultsView";
import { exampleCards } from "./data/publicBuilderContent";
import {
  exportAgent,
  previewAgent,
  PromptRejectedError,
  sendFeedback,
  trackPublicEvent,
} from "./lib/publicApi";
import {
  classifyPrompt,
  examplePrompts,
  localRejection,
  type PromptRejection,
} from "./lib/promptIntent";
import type { BackendStatus, PublicPreview, RuntimePlacard } from "./types";

type PlatformKey = RuntimePlacard["platform"];

const initialPrompt = "";

export default function App() {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<PromptRejection | null>(null);
  const [activeRuntime, setActiveRuntime] = useState<PlatformKey | null>(null);
  const [backend, setBackend] = useState<BackendStatus>({ state: "checking" });
  const [exportedPlatforms, setExportedPlatforms] = useState<Set<string>>(
    new Set(),
  );
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(
    null,
  );
  const [inspectingPlatform, setInspectingPlatform] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [promptHasFocused, setPromptHasFocused] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((health: { upstream_configured?: boolean; env?: string }) => {
        if (cancelled) return;
        if (health.upstream_configured) {
          setBackend({ state: "ready", env: health.env ?? "production" });
        } else {
          setBackend({ state: "not_configured" });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBackend({
          state: "unreachable",
          detail: err instanceof Error ? err.message : "Health check failed",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const verdict = useMemo(() => classifyPrompt(prompt), [prompt]);
  const canPreview =
    backend.state === "ready" &&
    prompt.trim().length > 4 &&
    verdict === "agent" &&
    !busy;
  const showEmptyHint = prompt.trim().length === 0 && promptHasFocused && !busy;

  function updatePrompt(next: string) {
    setPrompt(next);
    setError(null);
    setRejection(null);
  }

  function useExamplePrompt(next: string) {
    trackPublicEvent("example_prompt_click", { prompt_length: next.length });
    updatePrompt(next);
    requestAnimationFrame(() => {
      promptRef.current?.focus();
    });
  }

  async function build() {
    if (backend.state !== "ready" || busy) return;
    trackPublicEvent("preview_click", {
      prompt_length: prompt.trim().length,
      local_verdict: verdict,
    });
    if (verdict !== "agent") {
      setError(null);
      setPreview(null);
      setActiveRuntime(null);
      setRejection(localRejection(prompt));
      requestAnimationFrame(() => promptRef.current?.focus());
      return;
    }

    setBusy(true);
    setError(null);
    setRejection(null);
    setPreview(null);
    setActiveRuntime(null);
    setExportedPlatforms(new Set());
    setFeedbackSent(false);
    try {
      const result = await previewAgent(prompt.trim());
      setPreview(result);
      setActiveRuntime(result.placards[0]?.platform ?? null);
      requestAnimationFrame(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (err) {
      if (err instanceof PromptRejectedError) {
        setRejection(err.rejection);
        requestAnimationFrame(() => promptRef.current?.focus());
      } else {
        setError(err instanceof Error ? err.message : "Preview failed");
      }
    } finally {
      setBusy(false);
    }
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (prompt.trim().length === 0) return;
      void build();
    }
  }

  async function handleInspect(platform: string) {
    if (inspectingPlatform) return;
    trackPublicEvent("inspect_click", {
      platform,
      prompt_hash: preview?.prompt_hash ?? "",
    });
    setError(null);
    setInspectingPlatform(platform);
    try {
      const payload = await exportAgent(prompt.trim(), platform);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank", "noopener,noreferrer");
      // If the popup was blocked (win is null), revoke immediately so the
      // object URL doesn't linger in memory; otherwise give the new tab a brief
      // window to load before releasing it.
      if (!win) {
        URL.revokeObjectURL(url);
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspect failed");
    } finally {
      setInspectingPlatform(null);
    }
  }

  async function handleExport(platform: string) {
    if (exportingPlatform) return;
    trackPublicEvent("export_click", {
      platform,
      prompt_hash: preview?.prompt_hash ?? "",
    });
    setError(null);
    setExportingPlatform(platform);
    try {
      const payload = await exportAgent(prompt.trim(), platform);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matix-agent-${platform}.example.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportedPlatforms((prev) => {
        const next = new Set(prev);
        next.add(platform);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingPlatform(null);
    }
  }

  async function submitFeedback() {
    if (!feedback.trim() || feedbackBusy) return;
    trackPublicEvent("feedback_submit_click", {
      rating,
      did_export: exportedPlatforms.size > 0,
      has_email: feedbackEmail.trim().length > 0,
      prompt_hash: preview?.prompt_hash ?? "",
    });
    setFeedbackError(null);
    setFeedbackBusy(true);
    try {
      await sendFeedback({
        prompt: prompt.trim(),
        prompt_hash: preview?.prompt_hash,
        rating,
        feedback: feedback.trim(),
        email: feedbackEmail.trim() || undefined,
        did_export: exportedPlatforms.size > 0,
      });
      setFeedback("");
      setFeedbackEmail("");
      setRating(5);
      setFeedbackSent(true);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Feedback failed");
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <AppShell backend={backend}>
      <section className="builderWorkspace" aria-label="Agent builder">
        <div className="builderPrimary">
          <HeroSection />
          <BackendBanner backend={backend} />
          <PromptComposer
            backend={backend}
            busy={busy}
            canPreview={canPreview}
            error={error}
            examplePrompts={examplePrompts}
            onBuild={build}
            onExamplePrompt={useExamplePrompt}
            onFocus={() => setPromptHasFocused(true)}
            onKeyDown={onPromptKeyDown}
            onPromptChange={updatePrompt}
            prompt={prompt}
            promptRef={promptRef}
            rejection={rejection}
            showEmptyHint={showEmptyHint}
          />
          <ExamplePromptRail
            disabled={busy}
            examples={exampleCards}
            onSelect={useExamplePrompt}
          />
          {error && (
            <div className="banner banner-error" role="alert">
              <strong>Preview failed.</strong> {error}
            </div>
          )}
        </div>
        <ResultsView
          activeRuntime={activeRuntime}
          busy={busy}
          exportedPlatforms={exportedPlatforms}
          exportingPlatform={exportingPlatform}
          inspectingPlatform={inspectingPlatform}
          onActiveRuntimeChange={setActiveRuntime}
          onExport={handleExport}
          onInspect={handleInspect}
          preview={preview}
        />
      </section>
      {preview && (
        <FeedbackForm
          email={feedbackEmail}
          error={feedbackError}
          feedback={feedback}
          feedbackSent={feedbackSent}
          onEmailChange={setFeedbackEmail}
          onFeedbackChange={setFeedback}
          onRatingChange={setRating}
          onSubmit={submitFeedback}
          rating={rating}
          submitting={feedbackBusy}
        />
      )}
    </AppShell>
  );
}
