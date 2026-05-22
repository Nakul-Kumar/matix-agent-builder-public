import { useEffect, useMemo, useState } from "react";
import { exportAgent, previewAgent, sendFeedback } from "./lib/publicApi";
import type {
  PublicArtifact,
  PublicPreview,
  PublicSourceStatus,
  RuntimePlacard,
} from "./types";

const samplePrompt =
  "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.";
const repoUrl = "https://github.com/Nakul-Kumar/matix-agent-builder-public";
const legalLinks = [
  { label: "Privacy", href: `${repoUrl}/blob/main/PRIVACY.md` },
  { label: "Terms", href: `${repoUrl}/blob/main/TERMS.md` },
  { label: "Security", href: `${repoUrl}/blob/main/SECURITY.md` },
  { label: "GitHub", href: repoUrl },
];

const AGENT_KEYWORDS = [
  "agent", "assistant", "bot", "automation", "workflow",
  "helper", "tool", "build", "create", "make", "design",
  "generate", "ai", "llm", "chatbot", "copilot",
];

function validatePrompt(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 12) {
    return "Describe the agent in a bit more detail (at least 12 characters).";
  }
  const lower = trimmed.toLowerCase();
  if (!AGENT_KEYWORDS.some((w) => lower.includes(w))) {
    return "Include what the agent should do — for example words like \"agent\", \"assistant\", \"automation\", or \"build/create\".";
  }
  return null;
}

type PlatformKey = RuntimePlacard["platform"];

const platformTheme: Record<
  PlatformKey,
  {
    tone: string;
    accent: string;
    accentSoft: string;
    glow: string;
    tag: string;
    subtitle: string;
  }
> = {
  codex: {
    tone: "codex",
    accent: "#3b82f6",
    accentSoft: "rgba(59, 130, 246, 0.16)",
    glow: "rgba(59, 130, 246, 0.32)",
    tag: "OpenAI / Codex CLI",
    subtitle: "Cool, technical, structured exports",
  },
  claude_code: {
    tone: "claude",
    accent: "#cc785c",
    accentSoft: "rgba(204, 120, 92, 0.18)",
    glow: "rgba(204, 120, 92, 0.32)",
    tag: "Anthropic / Claude Code",
    subtitle: "Warm, careful, citation-friendly",
  },
  openclaw: {
    tone: "openclaw",
    accent: "#dc2626",
    accentSoft: "rgba(220, 38, 38, 0.18)",
    glow: "rgba(220, 38, 38, 0.32)",
    tag: "Open source / OpenClaw",
    subtitle: "Experimental, local-first, opinionated",
  },
};

const statusToneMap: Record<string, string> = {
  ok: "ok",
  ready: "ok",
  preview: "ok",
  synced: "ok",
  planned: "info",
  searched: "info",
  experimental: "warn",
  degraded: "warn",
  auth_required: "warn",
  rate_limited: "danger",
  error: "danger",
};

function statusTone(value: string): string {
  return statusToneMap[value.toLowerCase()] ?? "info";
}

function pretty(value: string): string {
  return value.replace(/_/g, " ");
}

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

const scoreLaneLabels: Record<string, string> = {
  task_fit: "task fit",
  source_trust: "source",
  license_trust: "license",
  artifact_quality: "quality",
  runtime_readiness: "runtime",
  credential_readiness: "creds",
  category_coverage: "coverage",
  safety_risk: "risk",
};

function ArtifactScoreLanes({
  scoreBreakdown,
}: {
  scoreBreakdown?: Record<string, number>;
}) {
  const lanes = Object.entries(scoreBreakdown ?? {}).filter(([, value]) =>
    Number.isFinite(value),
  );
  if (lanes.length === 0) return null;
  return (
    <div className="laneGrid" aria-label="Score breakdown">
      {lanes.map(([key, value]) => (
        <span key={key} className="lane">
          <span>{scoreLaneLabels[key] ?? pretty(key)}</span>
          <strong>{Math.round(value)}</strong>
        </span>
      ))}
    </div>
  );
}

function LicenseBadge({ artifact }: { artifact: PublicArtifact }) {
  const label = artifact.license?.name || "License pending";
  const confidence = artifact.license?.confidence ?? "low";
  if (artifact.license?.url) {
    return (
      <a
        className={`licenseBadge license-${confidence}`}
        href={artifact.license.url}
        target="_blank"
        rel="noreferrer noopener"
      >
        {label}
      </a>
    );
  }
  return <span className={`licenseBadge license-${confidence}`}>{label}</span>;
}

function ArtifactCard({ artifact }: { artifact: PublicArtifact }) {
  const credentialStatus = artifact.credential_status
    ? pretty(artifact.credential_status)
    : "not required";
  return (
    <li className="artifactCard">
      <div className="artifactTitleRow">
        <span className="artifactName">{artifact.name}</span>
        <LicenseBadge artifact={artifact} />
      </div>
      {artifact.description && (
        <span className="artifactDesc">{artifact.description}</span>
      )}
      {(artifact.capability_matches?.length || artifact.selected_by_model) && (
        <div className="capabilityMatches" aria-label="Capability matches">
          {artifact.selected_by_model && (
            <span className="capabilityChip modelChip">model-selected</span>
          )}
          {(artifact.capability_matches ?? []).slice(0, 4).map((capability) => (
            <span key={`${artifact.artifact_ref}-${capability}`} className="capabilityChip">
              {pretty(capability)}
            </span>
          ))}
        </div>
      )}
      {artifact.why_selected && (
        <p className="artifactWhy">
          <strong>Why selected</strong> {artifact.why_selected}
        </p>
      )}
      {artifact.setup_hint && (
        <p className="artifactSetup">
          <strong>Setup</strong> {artifact.setup_hint}
        </p>
      )}
      <div className="artifactMetaRow">
        <span>{pretty(artifact.artifact_kind)}</span>
        <span>{credentialStatus}</span>
        <span>{artifact.artifact_ref}</span>
      </div>
      <ArtifactScoreLanes scoreBreakdown={artifact.score_breakdown} />
      {artifact.warnings?.length > 0 && (
        <ul className="artifactWarnings">
          {artifact.warnings.map((warning, idx) => (
            <li key={`${artifact.artifact_ref}-warning-${idx}`}>{warning}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ArtifactList({
  items,
  empty,
}: {
  items: PublicArtifact[];
  empty: string;
}) {
  if (items.length === 0) return <p className="emptyHint">{empty}</p>;
  return (
    <ul className="artifactList">
      {items.map((item) => (
        <ArtifactCard key={item.artifact_ref} artifact={item} />
      ))}
    </ul>
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
  onExport: (platform: PlatformKey) => void;
}) {
  const theme = platformTheme[placard.platform] ?? {
    tone: "codex",
    accent: placard.accent || "#3b82f6",
    accentSoft: "rgba(59, 130, 246, 0.16)",
    glow: "rgba(59, 130, 246, 0.32)",
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
        if (links.length >= 6) break;
      }
      if (links.length >= 6) break;
    }
    return links;
  }, [placard]);

  const artifacts = useMemo(
    () => [...placard.skills, ...placard.mcps, ...placard.tools],
    [placard],
  );

  const licenseSummary = useMemo(() => {
    const seen = new Set<string>();
    return artifacts
      .map((artifact) => artifact.license)
      .filter((license) => {
        if (!license?.name || seen.has(`${license.name}:${license.url}`)) {
          return false;
        }
        seen.add(`${license.name}:${license.url}`);
        return true;
      })
      .slice(0, 6);
  }, [artifacts]);

  const credentialItems = artifacts.filter(
    (artifact) => artifact.credential_status === "missing",
  );

  const whySelected = artifacts
    .filter((artifact) => artifact.why_selected)
    .slice(0, 4);

  const artifactsByRef = useMemo(() => {
    const map = new Map<string, PublicArtifact>();
    for (const artifact of artifacts) map.set(artifact.artifact_ref, artifact);
    return map;
  }, [artifacts]);

  const tone = statusTone(placard.status);

  return (
    <article
      className={`placard placard-${theme.tone}`}
      style={
        {
          "--accent": theme.accent,
          "--accent-soft": theme.accentSoft,
          "--accent-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="placardGlow" aria-hidden="true" />
      <header className="placardTop">
        <div>
          <p className="platformTag">{theme.tag}</p>
          <h2>{placard.label}</h2>
          <p className="placardSubtitle">{theme.subtitle}</p>
        </div>
        <span className={`pill pill-${tone}`}>
          <span className="dot" /> {pretty(placard.status)}
        </span>
      </header>

      <div className="placardMeta">
        <span className="metaChip" title="Model">
          <span className="metaLabel">model</span>
          <span className="metaValue">{placard.model}</span>
        </span>
        <span className="metaChip" title="Memory mode">
          <span className="metaLabel">memory</span>
          <span className="metaValue">{pretty(placard.memory_mode)}</span>
        </span>
      </div>

      <div className="scores">
        <ScoreBar label="Trust" value={placard.scores.trust} />
        <ScoreBar label="Match" value={placard.scores.match} />
        <ScoreBar label="Use" value={placard.scores.popularity} />
        <ScoreBar label="Perf" value={placard.scores.performance} />
      </div>

      {placard.bundle_sections && placard.bundle_sections.length > 0 && (
        <Section title="Recommended bundle" count={placard.bundle_sections.length}>
          <div className="bundleSectionGrid">
            {placard.bundle_sections.map((section) => (
              <div className="bundleSectionCard" key={section.section_id}>
                <strong>{section.title}</strong>
                <div>
                  {section.artifact_refs
                    .map((ref) => artifactsByRef.get(ref))
                    .filter((artifact): artifact is PublicArtifact => Boolean(artifact))
                    .slice(0, 5)
                    .map((artifact) => (
                      <span key={`${section.section_id}-${artifact.artifact_ref}`}>
                        {artifact.name}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Export contents preview" count={placard.file_tree.length}>
        {placard.file_tree.length === 0 ? (
          <p className="emptyHint">No files in this template.</p>
        ) : (
          <div className="fileTree">
            {placard.file_tree.map((file) => (
              <code key={file}>{file}</code>
            ))}
          </div>
        )}
      </Section>

      {whySelected.length > 0 && (
        <Section title="Why selected" count={whySelected.length}>
          <ul className="rationaleList">
            {whySelected.map((artifact) => (
              <li key={`${artifact.artifact_ref}-why`}>
                <strong>{artifact.name}</strong>
                <span>{artifact.why_selected}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Skills" count={placard.skills.length}>
        <ArtifactList items={placard.skills} empty="No skills attached." />
      </Section>

      <Section
        title="MCPs & tools"
        count={placard.mcps.length + placard.tools.length}
      >
        <ArtifactList
          items={[...placard.mcps, ...placard.tools]}
          empty="No MCPs or tools."
        />
      </Section>

      {licenseSummary.length > 0 && (
        <Section title="Licenses" count={licenseSummary.length}>
          <div className="licenseList">
            {licenseSummary.map((license) =>
              license.url ? (
                <a
                  key={`${license.name}-${license.url}`}
                  href={license.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {license.name}
                  <span>{pretty(license.confidence)}</span>
                </a>
              ) : (
                <span key={license.name}>
                  {license.name}
                  <em>{pretty(license.confidence)}</em>
                </span>
              ),
            )}
          </div>
        </Section>
      )}

      <Section title="Missing credentials" count={credentialItems.length}>
        {credentialItems.length === 0 ? (
          <p className="emptyHint">No credentials are required for the public-safe export.</p>
        ) : (
          <ul className="credentialList">
            {credentialItems.map((artifact) => (
              <li key={`${artifact.artifact_ref}-credential`}>
                <strong>{artifact.name}</strong>
                <span>{pretty(artifact.credential_status)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Setup instructions">
        <ul className="setupList">
          <li>Open <code>START_HERE.md</code> from the exported bundle first.</li>
          <li>Review <code>LICENSES.md</code> and <code>manifest.json</code> before enabling runtime placeholders.</li>
          <li>Enable MCP credentials only in the target runtime, never in the browser.</li>
        </ul>
      </Section>

      {placard.eval_plan.length > 0 && (
        <Section title="Eval plan" count={placard.eval_plan.length}>
          <ol className="evalList">
            {placard.eval_plan.map((step, idx) => (
              <li key={`${placard.platform}-eval-${idx}`}>{step}</li>
            ))}
          </ol>
        </Section>
      )}

      {sourceLinks.length > 0 && (
        <Section title="Source links" count={sourceLinks.length}>
          <div className="links">
            {sourceLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
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
          ? "Preparing safe bundle..."
          : exported
            ? "Exported / download again"
            : "Export safe bundle"}
      </button>
    </article>
  );
}

function PlacardSkeleton({ tone }: { tone: PlatformKey }) {
  const theme = platformTheme[tone];
  return (
    <article
      className={`placard placard-${theme.tone} skeleton`}
      aria-hidden="true"
      style={
        {
          "--accent": theme.accent,
          "--accent-soft": theme.accentSoft,
          "--accent-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="placardGlow" />
      <div className="skeletonLine wide" />
      <div className="skeletonLine medium" />
      <div className="skeletonLine short" />
      <div className="skeletonGrid">
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
      </div>
      <div className="skeletonLine medium" />
      <div className="skeletonLine wide" />
      <div className="skeletonBlock tall" />
    </article>
  );
}

function SourceStatusRail({ statuses }: { statuses: PublicSourceStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <section className="sourceStatus">
      <header className="sourceStatusHead">
        <p className="platformTag">Source search status</p>
        <h3>Directories and marketplaces checked</h3>
      </header>
      <div className="statusGrid">
        {statuses.map((source) => {
          const tone = statusTone(source.status);
          return (
            <div
              className={`statusCell statusCell-${tone}`}
              key={source.source_id}
            >
              <div className="statusCellTop">
                <span className="statusCellLabel">{source.label}</span>
                <span className={`pill pill-${tone}`}>
                  <span className="dot" /> {pretty(source.status)}
                </span>
              </div>
              {source.message && (
                <p className="statusCellMsg">{source.message}</p>
              )}
              {source.quarantine_review_required && (
                <span className="quarantineFlag">Manual review required</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DomainRail({ preview }: { preview: PublicPreview }) {
  const confidence = preview.intent_confidence;
  const trace = preview.model_trace_summary;
  const intent = preview.intent;
  const mustHave = intent?.must_have_capabilities ?? trace?.must_have_capabilities ?? [];
  const niceToHave = intent?.nice_to_have_capabilities ?? [];
  const queries = intent?.query_expansions ?? trace?.source_queries ?? [];
  if (!preview.agent_archetype && !intent?.domain_label && !trace?.summary && !preview.fallback_reason) {
    return null;
  }
  return (
    <section className="domainRail">
      <div>
        <p className="platformTag">Recommendation decision</p>
        <h3>
          {intent?.domain_label || preview.agent_archetype
            ? `Detected intent: ${intent?.domain_label ?? preview.agent_archetype}`
            : "Backend-selected domain"}
        </h3>
        {intent?.agent_archetype && intent.agent_archetype !== intent.domain_label && (
          <p className="intentSubline">Runtime label: {intent.agent_archetype}</p>
        )}
        {trace?.summary && <p>{trace.summary}</p>}
        {intent?.ambiguity && <p className="fallbackNote">{intent.ambiguity}</p>}
        {preview.fallback_reason && (
          <p className="fallbackNote">{preview.fallback_reason}</p>
        )}
      </div>
      <div className="domainChips">
        {preview.agent_domain && (
          <span className="pill pill-ok">
            <span className="dot" /> {pretty(preview.agent_domain)}
          </span>
        )}
        {Number.isFinite(confidence) && (
          <span className="pill pill-ok">
            <span className="dot" /> {Math.round(confidence ?? 0)}% confidence
          </span>
        )}
        {trace?.reranker_status && (
          <span
            className={`pill pill-${
              trace.reranker_status === "completed" ? "ok" : "warn"
            }`}
          >
            <span className="dot" /> {pretty(trace.reranker_status)}
          </span>
        )}
        {intent?.model_status && (
          <span className="pill pill-ok">
            <span className="dot" /> {pretty(intent.model_status)}
          </span>
        )}
        {intent?.cache_status && (
          <span className={`pill pill-${intent.cache_status === "hit" ? "ok" : "warn"}`}>
            <span className="dot" /> cache {pretty(intent.cache_status)}
          </span>
        )}
      </div>
      {mustHave.length > 0 && (
        <div className="intentPanel">
          <span className="intentPanelTitle">Must-have capabilities</span>
          <div className="capabilityMatches">
            {mustHave.slice(0, 10).map((capability) => (
              <span key={`must-${capability}`} className="capabilityChip">
                {pretty(capability)}
              </span>
            ))}
          </div>
        </div>
      )}
      {niceToHave.length > 0 && (
        <div className="intentPanel">
          <span className="intentPanelTitle">Nice-to-have coverage</span>
          <div className="capabilityMatches">
            {niceToHave.slice(0, 6).map((capability) => (
              <span key={`nice-${capability}`} className="capabilityChip mutedChip">
                {pretty(capability)}
              </span>
            ))}
          </div>
        </div>
      )}
      {queries.length > 0 && (
        <div className="intentPanel">
          <span className="intentPanelTitle">Source query expansions</span>
          <div className="queryChips">
            {queries.slice(0, 8).map((query) => (
              <span key={`query-${query}`}>{query}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CalibrationRail({ preview }: { preview: PublicPreview }) {
  const teacher = preview.calibration?.teacher;
  const students = preview.calibration?.students ?? [];
  const selectionSource = preview.selection_source ?? preview.model.status;
  const teacherRanked = selectionSource === "gpt_5_5_rerank";
  if (!teacher && students.length === 0) return null;
  return (
    <section className="calibrationRail">
      <div>
        <p className="platformTag">Recommendation model policy</p>
        <h3>
          {teacher && teacherRanked
            ? `${teacher.provider} / ${teacher.model} ranks the quality bundle`
            : selectionSource
              ? `${pretty(selectionSource)} used for this preview`
              : "Backend-controlled model routing"}
        </h3>
        {preview.calibration?.public_serving_policy && (
          <p>{preview.calibration.public_serving_policy}</p>
        )}
      </div>
      {students.length > 0 && (
        <div className="studentModels">
          {students.map((student) => (
            <span
              key={`${student.provider}-${student.model}`}
              className={`pill pill-${student.public_eligible ? "ok" : "warn"}`}
            >
              <span className="dot" />
              {student.provider} / {student.model}:{" "}
              {student.public_eligible ? "public eligible" : pretty(student.role)}
            </span>
          ))}
        </div>
      )}
    </section>
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
  const [errorContext, setErrorContext] = useState<"preview" | "export" | null>(null);
  const [exportedPlatforms, setExportedPlatforms] = useState<Set<string>>(
    new Set(),
  );
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(
    null,
  );

  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [backend, setBackend] = useState<BackendStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
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

  const promptError = useMemo(
    () => (prompt.trim().length === 0 ? null : validatePrompt(prompt)),
    [prompt],
  );

  const canBuild =
    backend.state === "ready" && !busy && !promptError && prompt.trim().length > 0;

  async function build() {
    if (!canBuild) return;
    setBusy(true);
    setError(null);
    setErrorContext(null);
    setPreview(null);
    setExportedPlatforms(new Set());
    setFeedbackSent(false);
    try {
      const result = await previewAgent(prompt.trim());
      setPreview(result);
      requestAnimationFrame(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setErrorContext("preview");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(platform: string) {
    if (exportingPlatform) return;
    setError(null);
    setErrorContext(null);
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
      setErrorContext("export");
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

  const policy = preview?.source_policy;

  return (
    <main>
      <header className="topbar">
        <div className="brandRow">
          <div className="mark" aria-hidden="true">
            M
          </div>
          <div className="brand">
            <span className="brandName">Matix Agent Builder</span>
            <span className="brandTag">Public preview / same-origin only</span>
          </div>
        </div>
        <div className="topbarRight">
          <span className={`pill pill-${backend.state === "ready" ? "ok" : backend.state === "checking" ? "info" : "warn"}`}>
            <span className="dot" />
            {backend.state === "checking" && "Connecting..."}
            {backend.state === "ready" && `Backend / ${backend.env}`}
            {backend.state === "not_configured" && "Backend not configured"}
            {backend.state === "unreachable" && "Backend unreachable"}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="heroBadges">
          <span className="badge badge-codex">Codex</span>
          <span className="badge badge-claude">Claude Code</span>
          <span className="badge badge-openclaw">OpenClaw</span>
        </div>
        <h1>
          One prompt.
          <br />
          <span className="heroAccent">Three ready-to-use agents.</span>
        </h1>
        <p className="heroLead">
          Describe the agent you need. The Matix cockpit returns source-linked
          skills, MCPs, evaluation plans, and safe example exports for Codex,
          Claude Code, and OpenClaw - side by side.
        </p>

        <div className="promptBox">
          <div className="promptHeader">
            <label htmlFor="prompt" className="promptLabel">
              Describe your agent
            </label>
            <span className="promptCount">{prompt.length}/1000</span>
          </div>
          <textarea
            id="prompt"
            value={prompt}
            maxLength={1000}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onPromptKeyDown}
            placeholder="Build a customer support agent that reads our Notion docs and files Linear bugs..."
            disabled={backend.state !== "ready"}
            aria-invalid={Boolean(promptError)}
            aria-describedby={promptError ? "prompt-error" : undefined}
          />
          {promptError && (
            <p
              id="prompt-error"
              style={{ margin: "8px 0 0", fontSize: 13, color: "var(--danger)" }}
              role="status"
            >
              {promptError}
            </p>
          )}
          <div className="promptActions">
            <p className="trustNote">
              No provider keys run in the browser. This page calls only
              same-origin <code>/api/public/*</code>. Exports are safe example
              files with placeholders.
            </p>
            <div className="promptCta">
              <span className="kbd">Cmd/Ctrl + Enter</span>
              <button
                className="primaryButton"
                onClick={build}
                disabled={!canBuild}
              >
                {busy ? "Building blueprint..." : "Build agent"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {backend.state === "not_configured" && (
        <div className="banner banner-warn" role="status">
          <strong>Backend not configured.</strong> The public API base is unset
          on this deployment, so previews and exports are disabled. Set{" "}
          <code>MATIX_PUBLIC_API_BASE</code> to the cockpit&apos;s public
          endpoint to enable the builder.
        </div>
      )}

      {backend.state === "unreachable" && (
        <div className="banner banner-error" role="alert">
          <strong>Public server unreachable.</strong>{" "}
          {(backend as { state: "unreachable"; detail: string }).detail}
        </div>
      )}

      {error && (
        <div className="banner banner-error" role="alert">
          <strong>{errorContext === "export" ? "Export failed." : "Preview failed."}</strong> {error}
        </div>
      )}

      {busy && (
        <section className="results" aria-busy="true" aria-live="polite">
          <div className="resultHeader">
            <div>
              <p className="platformTag">Backend-approved preview</p>
              <h2 className="loadingTitle">
                Composing three runtime blueprints...
              </h2>
            </div>
          </div>
          <div className="placards">
            <PlacardSkeleton tone="codex" />
            <PlacardSkeleton tone="claude_code" />
            <PlacardSkeleton tone="openclaw" />
          </div>
        </section>
      )}

      {!busy && preview && (
        <section className="results" id="results">
          <div className="resultHeader">
            <div>
              <p className="platformTag">Backend-approved preview</p>
              <h2>{preview.normalized_prompt}</h2>
              <div className="resultMeta">
                <span className="resultMetaChip">
                  {preview.model.provider} / {preview.model.name}
                </span>
                <span className="resultMetaChip">
                  {pretty(preview.selection_source ?? preview.model.status)}
                </span>
                <span className="resultMetaDim">
                  {new Date(preview.generated_at).toLocaleString()}
                </span>
              </div>
            </div>
            <span className="pill pill-ok">
              <span className="dot" /> {preview.placards.length} blueprints
            </span>
          </div>

          <SourceStatusRail statuses={preview.source_statuses ?? []} />
          <DomainRail preview={preview} />
          <CalibrationRail preview={preview} />

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

          {policy && (
            <div className="policy">
              <span>
                <strong>Browser provider calls</strong>{" "}
                {policy.browser_provider_calls ? "yes" : "no"}
              </span>
              <span>
                <strong>Secrets included</strong>{" "}
                {policy.secrets_included ? "yes" : "no"}
              </span>
              <span>
                <strong>Allowed source hosts</strong>{" "}
                {policy.allowed_source_hosts.length}
              </span>
            </div>
          )}
        </section>
      )}

      <section className="feedback">
        <header className="feedbackHead">
          <p className="platformTag">Feedback</p>
          <h2>What would make this blueprint better?</h2>
          <p className="feedbackHint">
            We read every note. Optional email if you&apos;d like a reply;
            feedback may be stored under the public preview privacy policy.
          </p>
        </header>

        {feedbackSent ? (
          <div className="feedbackThanks" role="status">
            <strong>Thanks - that&apos;s in.</strong> Your note went straight to
            the Matix team.
          </div>
        ) : (
          <div className="feedbackForm">
            <div className="ratingRow">
              <span className="ratingLabel">Rating</span>
              <div className="stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={value === rating}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    className={`star ${value <= rating ? "starOn" : ""}`}
                    onClick={() => setRating(value)}
                  >
                    *
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
            <input
              type="email"
              value={feedbackEmail}
              onChange={(event) => setFeedbackEmail(event.target.value)}
              placeholder="Email (optional)"
              autoComplete="email"
              className="emailInput"
            />
            {feedbackError && <p className="feedbackError">{feedbackError}</p>}
            <button
              className="secondaryButton"
              onClick={submitFeedback}
              disabled={feedbackBusy || !feedback.trim()}
            >
              {feedbackBusy ? "Sending..." : "Send feedback"}
            </button>
          </div>
        )}
      </section>

      <footer className="footer">
        <span>Matix Agent Builder / Public preview</span>
        <nav className="footerLinks" aria-label="Public project links">
          {legalLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <span className="footerDim">
          Same-origin /api/public/* only / no provider keys in the browser
        </span>
      </footer>
    </main>
  );
}
