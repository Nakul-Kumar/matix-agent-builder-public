import { useEffect, useMemo, useState } from "react";
import { exportAgent, getHealth, previewAgent, sendFeedback } from "./lib/publicApi";
import type { PublicPreview, RuntimePlacard, RuntimePlatform } from "./types";

const samplePrompt =
  "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.";

const platformTheme: Record<
  RuntimePlatform,
  { tone: string; accent: string; tag: string; subtitle: string }
> = {
  codex: {
    tone: "codex",
    accent: "#4aa8ff",
    tag: "Technical",
    subtitle: "Codex CLI runtime",
  },
  claude_code: {
    tone: "claude",
    accent: "#e8a06b",
    tag: "Anthropic",
    subtitle: "Claude Code runtime",
  },
  openclaw: {
    tone: "openclaw",
    accent: "#dc2626",
    tag: "Open source",
    subtitle: "OpenClaw experimental runtime",
  },
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="score">
      <div className="scoreRow">
        <span>{label}</span>
        <strong>{pct}</strong>
      </div>
      <div className="scoreTrack" aria-hidden="true">
        <div className="scoreFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="placardSection">
      <header>
        <h3>{title}</h3>
        {typeof count === "number" && <span className="count">{count}</span>}
      </header>
      {children}
    </section>
  );
}

function Placard({
  placard,
  exporting,
  exported,
  onExport,
}: {
  placard: RuntimePlacard;
  exporting: boolean;
  exported: boolean;
  onExport: (platform: RuntimePlatform) => void;
}) {
  const theme = platformTheme[placard.platform] ?? {
    tone: "codex",
    accent: placard.accent || "#4aa8ff",
    tag: "Runtime",
    subtitle: placard.label,
  };
  const sourceLinks = useMemo(() => {
    const seen = new Set<string>();
    const links: { label: string; url: string }[] = [];
    for (const item of [...placard.skills, ...placard.mcps, ...placard.tools]) {
      for (const link of item.source_links ?? []) {
        if (!link?.url || seen.has(link.url)) continue;
        seen.add(link.url);
        links.push({ label: link.label || link.url, url: link.url });
        if (links.length >= 5) break;
      }
      if (links.length >= 5) break;
    }
    return links;
  }, [placard]);

  return (
    <article
      className={`placard placard-${theme.tone}`}
      style={{ "--accent": theme.accent } as React.CSSProperties}
    >
      <header className="placardTop">
        <div>
          <p className="platformTag">{theme.tag}</p>
          <h2>{placard.label}</h2>
          <p className="placardSubtitle">{theme.subtitle}</p>
        </div>
        <span className={`status status-${placard.status.toLowerCase()}`}>
          <span className="statusDot" /> {placard.status}
        </span>
      </header>

      <p className="model" title={placard.model}>
        {placard.model}
        <span className="memoryMode">{placard.memory_mode}</span>
      </p>

      <div className="scores">
        <ScoreBar label="Trust" value={placard.scores.trust} />
        <ScoreBar label="Match" value={placard.scores.match} />
        <ScoreBar label="Use" value={placard.scores.popularity} />
        <ScoreBar label="Perf" value={placard.scores.performance} />
      </div>

      <Section title="File tree" count={placard.file_tree.length}>
        <div className="fileTree">
          {placard.file_tree.length === 0 ? (
            <p className="emptyHint">No files in this template.</p>
          ) : (
            placard.file_tree.map((file) => <code key={file}>{file}</code>)
          )}
        </div>
      </Section>

      <Section title="Skills" count={placard.skills.length}>
        {placard.skills.length === 0 ? (
          <p className="emptyHint">No skills attached.</p>
        ) : (
          <ul className="artifactList">
            {placard.skills.map((skill) => (
              <li key={skill.artifact_ref}>
                <span className="artifactName">{skill.name}</span>
                {skill.description && (
                  <span className="artifactDesc">{skill.description}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="MCPs & tools"
        count={placard.mcps.length + placard.tools.length}
      >
        {placard.mcps.length + placard.tools.length === 0 ? (
          <p className="emptyHint">No MCPs or tools.</p>
        ) : (
          <div className="chips">
            {placard.mcps.map((item) => (
              <span key={item.artifact_ref} className="chip chip-mcp">
                {item.name}
              </span>
            ))}
            {placard.tools.map((item) => (
              <span key={item.artifact_ref} className="chip chip-tool">
                {item.name}
              </span>
            ))}
          </div>
        )}
      </Section>

      {placard.eval_plan.length > 0 && (
        <Section title="Eval plan" count={placard.eval_plan.length}>
          <ul className="evalList">
            {placard.eval_plan.map((step, idx) => (
              <li key={`${placard.platform}-eval-${idx}`}>{step}</li>
            ))}
          </ul>
        </Section>
      )}

      {sourceLinks.length > 0 && (
        <Section title="Source links" count={sourceLinks.length}>
          <div className="links">
            {sourceLinks.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label}
              </a>
            ))}
          </div>
        </Section>
      )}

      {placard.warnings.length > 0 && (
        <ul className="warnings">
          {placard.warnings.map((warning, idx) => (
            <li key={`${placard.platform}-w-${idx}`}>{warning}</li>
          ))}
        </ul>
      )}

      <button
        className="exportButton"
        onClick={() => onExport(placard.platform)}
        disabled={exporting}
      >
        {exporting
          ? "Preparing safe bundle…"
          : exported
            ? "Exported · download again"
            : "Export safe bundle"}
      </button>
    </article>
  );
}

function PlacardSkeleton() {
  return (
    <article className="placard skeleton" aria-hidden="true">
      <div className="skeletonLine wide" />
      <div className="skeletonLine" />
      <div className="skeletonGrid">
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
      </div>
      <div className="skeletonLine" />
      <div className="skeletonLine wide" />
      <div className="skeletonLine" />
      <div className="skeletonBlock tall" />
    </article>
  );
}

type BackendStatus =
  | { state: "checking" }
  | { state: "ready"; env: string }
  | { state: "not_configured" }
  | { state: "unreachable"; detail: string };

export default function App() {
  const [prompt, setPrompt] = useState(samplePrompt);
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedPlatforms, setExportedPlatforms] = useState<Set<string>>(
    new Set(),
  );
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(null);

  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [backend, setBackend] = useState<BackendStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (cancelled) return;
        if (health.upstream_configured) {
          setBackend({ state: "ready", env: health.env });
        } else {
          setBackend({ state: "not_configured" });
        }
      })
      .catch((err) => {
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

  const canBuild =
    backend.state === "ready" && prompt.trim().length > 4 && !busy;

  async function build() {
    if (!canBuild) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setExportedPlatforms(new Set());
    setFeedbackSent(false);
    try {
      const result = await previewAgent(prompt.trim());
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(platform: string) {
    if (exportingPlatform) return;
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
      setFeedbackSent(true);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Feedback failed");
    } finally {
      setFeedbackBusy(false);
    }
  }

  function onPromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void build();
    }
  }

  const backendBanner = (() => {
    if (backend.state === "not_configured") {
      return (
        <div className="banner banner-warn" role="status">
          <strong>Backend not configured.</strong> The public API base is unset on
          this deployment, so previews and exports are disabled. Set{" "}
          <code>MATIX_PUBLIC_API_BASE</code> to the cockpit&apos;s public endpoint
          to enable the builder.
        </div>
      );
    }
    if (backend.state === "unreachable") {
      return (
        <div className="banner banner-error" role="alert">
          <strong>Public server unreachable.</strong> {backend.detail}
        </div>
      );
    }
    return null;
  })();

  return (
    <main>
      <section className="hero">
        <nav>
          <div className="mark" aria-hidden="true">M</div>
          <div className="brand">
            <span className="brandName">Matix Agent Builder</span>
            <span className="brandTag">Public preview</span>
          </div>
          <span className={`pill pill-${backend.state}`}>
            {backend.state === "checking" && "Connecting…"}
            {backend.state === "ready" && `Backend · ${backend.env}`}
            {backend.state === "not_configured" && "Backend not configured"}
            {backend.state === "unreachable" && "Backend unreachable"}
          </span>
        </nav>

        <div className="heroGrid">
          <div className="heroCopy">
            <h1>
              One prompt. Three ready-to-use agents.
            </h1>
            <p>
              Describe the agent you need. The Matix cockpit returns
              source-linked skills, MCPs, evaluation plans, and safe example
              exports for Codex, Claude Code, and OpenClaw, side by side.
            </p>
          </div>

          <div className="promptBox">
            <label htmlFor="prompt" className="promptLabel">
              Describe your agent
            </label>
            <textarea
              id="prompt"
              value={prompt}
              maxLength={1000}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onPromptKeyDown}
              placeholder="Build a customer support agent that reads our Notion docs and files Linear bugs…"
              disabled={backend.state !== "ready"}
            />
            <div className="promptMeta">
              <span>{prompt.length}/1000</span>
              <span className="kbd">⌘/Ctrl + Enter</span>
            </div>
            <button
              className="primaryButton"
              onClick={build}
              disabled={!canBuild}
            >
              {busy ? "Building blueprint…" : "Build agent"}
            </button>
            <p className="trustNote">
              No provider keys run in the browser. This page calls only
              same-origin <code>/api/public/*</code> routes. Exports are safe
              example files with placeholders.
            </p>
          </div>
        </div>
      </section>

      {backendBanner}

      {error && (
        <div className="banner banner-error" role="alert">
          <strong>Preview failed.</strong> {error}
        </div>
      )}

      {busy && (
        <section className="results" aria-busy="true" aria-live="polite">
          <div className="resultHeader">
            <div>
              <p className="platformTag">Backend-approved preview</p>
              <h2 className="loadingTitle">Composing three runtime blueprints…</h2>
            </div>
          </div>
          <div className="placards">
            <PlacardSkeleton />
            <PlacardSkeleton />
            <PlacardSkeleton />
          </div>
        </section>
      )}

      {!busy && preview && (
        <section className="results">
          <div className="resultHeader">
            <div>
              <p className="platformTag">Backend-approved preview</p>
              <h2>{preview.normalized_prompt}</h2>
              <p className="resultMeta">
                Model {preview.model.name} · {preview.model.status} ·{" "}
                {new Date(preview.generated_at).toLocaleString()}
              </p>
            </div>
            <span className="status status-ok">
              <span className="statusDot" /> {preview.placards.length} blueprints
            </span>
          </div>

          <div className="placards">
            {preview.placards.map((placard) => (
              <Placard
                key={placard.platform}
                placard={placard}
                exporting={exportingPlatform === placard.platform}
                exported={exportedPlatforms.has(placard.platform)}
                onExport={handleExport}
              />
            ))}
          </div>

          {preview.source_policy && (
            <p className="policy">
              <span>Browser provider calls: <strong>{String(preview.source_policy.browser_provider_calls)}</strong></span>
              <span>Secrets included: <strong>{String(preview.source_policy.secrets_included)}</strong></span>
              {preview.source_policy.allowed_source_hosts?.length > 0 && (
                <span>
                  Allowed hosts:{" "}
                  <strong>
                    {preview.source_policy.allowed_source_hosts.join(", ")}
                  </strong>
                </span>
              )}
            </p>
          )}
        </section>
      )}

      {!busy && !preview && backend.state === "ready" && !error && (
        <section className="emptyState">
          <h2>Ready when you are.</h2>
          <p>
            Type a prompt above and click <strong>Build agent</strong> to see
            the Codex, Claude Code, and OpenClaw blueprints.
          </p>
        </section>
      )}

      <section className="feedback">
        <div className="feedbackHeader">
          <p className="platformTag">Feedback</p>
          <h2>What would make this blueprint better?</h2>
          <p className="feedbackHint">
            Feedback goes to the Matix team. No LLM calls are made from this
            form.
          </p>
        </div>

        {feedbackSent ? (
          <div className="feedbackSuccess" role="status">
            <strong>Thanks, feedback received.</strong>
            <p>We use this to tune the public templates and scoring.</p>
            <button
              className="ghostButton"
              onClick={() => setFeedbackSent(false)}
            >
              Send more feedback
            </button>
          </div>
        ) : (
          <div className="feedbackForm">
            <div className="ratingRow">
              <span className="ratingLabel">Rating</span>
              <div className="stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={rating === n}
                    className={`star ${n <= rating ? "starOn" : ""}`}
                    onClick={() => setRating(n)}
                    type="button"
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={feedback}
              maxLength={2000}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us what was useful, missing, or confusing."
            />

            <label className="emailField">
              <span>Email (optional)</span>
              <input
                type="email"
                value={feedbackEmail}
                maxLength={200}
                onChange={(event) => setFeedbackEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            {feedbackError && (
              <div className="banner banner-error" role="alert">
                {feedbackError}
              </div>
            )}

            <button
              className="primaryButton"
              onClick={submitFeedback}
              disabled={!feedback.trim() || feedbackBusy}
            >
              {feedbackBusy ? "Sending…" : "Send feedback"}
            </button>
          </div>
        )}
      </section>

      <footer className="footer">
        <span>Matix Agent Builder · public preview</span>
        <span>
          Source-linked, backend-approved. No provider keys in the browser.
        </span>
      </footer>
    </main>
  );
}
