import { useEffect, useMemo, useRef, useState } from "react";
import { ResultCard, type ResultCardDotTone } from "./components/ResultCard";
import {
  exportAgent,
  previewAgent,
  sendFeedback,
  PromptRejectedError,
} from "./lib/publicApi";
import {
  classifyPrompt,
  examplePrompts,
  localRejection,
  type PromptRejection,
} from "./lib/promptIntent";
import type {
  PublicArtifact,
  PublicArtifactLicense,
  PublicPreview,
  PublicSourceLink,
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
    accent: "#C2674A",
    accentSoft: "rgba(194, 103, 74, 0.12)",
    glow: "rgba(194, 103, 74, 0.18)",
    tag: "OpenAI / Codex CLI",
    subtitle: "Cool, technical, structured exports",
  },
  claude_code: {
    tone: "claude",
    accent: "#C2674A",
    accentSoft: "rgba(194, 103, 74, 0.12)",
    glow: "rgba(194, 103, 74, 0.18)",
    tag: "Anthropic / Claude Code",
    subtitle: "Warm, careful, citation-friendly",
  },
  openclaw: {
    tone: "openclaw",
    accent: "#C2674A",
    accentSoft: "rgba(194, 103, 74, 0.12)",
    glow: "rgba(194, 103, 74, 0.18)",
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
    accent: "#C2674A",
    accentSoft: "rgba(194, 103, 74, 0.12)",
    glow: "rgba(194, 103, 74, 0.18)",
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
    (artifact) => artifact.credential_status !== "not_required",
  );

  const whySelected = artifacts
    .filter((artifact) => artifact.why_selected)
    .slice(0, 4);

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

function deriveSourceKind(source: PublicSourceStatus): string {
  const haystack = `${source.source_id} ${source.label}`.toLowerCase();
  if (/registry/.test(haystack)) return "REGISTRY";
  if (/market|marketplace|store/.test(haystack)) return "MARKET";
  if (/mirror|cache/.test(haystack)) return "MIRROR";
  return "DIRECTORY";
}

function sourceStatusDotTone(status: string): ResultCardDotTone {
  const s = status.toLowerCase();
  if (s === "synced" || s === "searched" || s === "ok") return "ok";
  if (s === "auth_required" || s === "rate_limited") return "accent";
  return "muted";
}

function SourceStatusSection({
  statuses,
}: {
  statuses: PublicSourceStatus[];
}) {
  const filtered = statuses.filter(
    (s) => !/^search:/i.test(s.label.trim()),
  );
  if (filtered.length === 0) return null;
  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— I. SOURCE SEARCH STATUS</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          —— {filtered.length} {filtered.length === 1 ? "DIRECTORY" : "DIRECTORIES"} SEARCHED
        </p>
      </header>
      <div className="resultCardGrid">
        {filtered.map((source) => (
          <ResultCard
            key={source.source_id}
            category={deriveSourceKind(source)}
            title={source.label}
            preview={source.message ?? ""}
            footnote={pretty(source.status).toUpperCase()}
            dotTone={sourceStatusDotTone(source.status)}
          />
        ))}
      </div>
    </section>
  );
}

function placardStatusDotTone(status: string): ResultCardDotTone {
  const s = status.toLowerCase();
  if (s === "preview" || s === "synced" || s === "ok" || s === "ready")
    return "ok";
  if (s === "experimental" || s === "warn") return "accent";
  return "muted";
}

function BlueprintsSection({ placards }: { placards: RuntimePlacard[] }) {
  if (placards.length === 0) return null;
  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— III. BLUEPRINTS</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">—— {placards.length} RUNTIMES</p>
      </header>
      <div className="blueprintList">
        {placards.map((placard) => (
          <BlueprintGroup key={placard.platform} placard={placard} />
        ))}
      </div>
    </section>
  );
}

function BlueprintGroup({ placard }: { placard: RuntimePlacard }) {
  const theme = platformTheme[placard.platform] ?? {
    tag: "Runtime",
    subtitle: placard.label,
  };

  const runtimeName = placard.label.replace(/\s+blueprint\s*$/i, "");
  const headerTitle = `${runtimeName} blueprint`;
  const headerFootnote = `${pretty(placard.status).toUpperCase()} · TRUST ${Math.round(placard.scores.trust)} · MATCH ${Math.round(placard.scores.match)}`;

  const tools = [...placard.mcps, ...placard.tools];
  const whySelected = [...placard.skills, ...tools].filter(
    (a) => a.why_selected,
  );

  return (
    <div className="blueprintGroup">
      <ResultCard
        category="BLUEPRINT"
        title={headerTitle}
        preview={theme.subtitle}
        footnote={headerFootnote}
        dotTone={placardStatusDotTone(placard.status)}
      />
      <div className="blueprintScroll">
        <div className="blueprintRail" aria-hidden="true" />
        <div className="blueprintStrip">
          {placard.skills.map((a) => (
            <ResultCard
              key={`${placard.platform}-skill-${a.artifact_ref}`}
              category="SKILL"
              title={a.name}
              preview={a.description}
              footnote={`${(a.license?.source ?? "SOURCE").toUpperCase()} · TASK FIT ${Math.round(a.match)} · QUALITY ${Math.round(a.performance)}`}
            />
          ))}
          {tools.map((a) => (
            <ResultCard
              key={`${placard.platform}-mcp-${a.artifact_ref}`}
              category="MCP"
              title={a.name}
              preview={a.description}
              footnote={`${(a.license?.source ?? "SOURCE").toUpperCase()} · TRUST ${Math.round(a.trust)} · QUALITY ${Math.round(a.performance)}`}
            />
          ))}
          {placard.file_tree.map((file) => (
            <ResultCard
              key={`${placard.platform}-file-${file}`}
              category="FILE"
              title={file}
              preview={`Included in the ${runtimeName} bundle`}
              footnote="EXPORTED"
              dotTone="muted"
            />
          ))}
          {whySelected.map((a) => (
            <ResultCard
              key={`${placard.platform}-why-${a.artifact_ref}`}
              category="REASON"
              title={a.name}
              preview={a.why_selected}
              footnote="MATCHED"
              dotTone="accent"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function aggregateArtifacts(placards: RuntimePlacard[]): PublicArtifact[] {
  const seen = new Set<string>();
  const out: PublicArtifact[] = [];
  for (const p of placards) {
    for (const a of [...p.skills, ...p.mcps, ...p.tools]) {
      if (seen.has(a.artifact_ref)) continue;
      seen.add(a.artifact_ref);
      out.push(a);
    }
  }
  return out;
}

function licenseSeverity(confidence: string): {
  label: string;
  tone: ResultCardDotTone;
} {
  const c = confidence.toLowerCase();
  if (c === "high") return { label: "LOW", tone: "ok" };
  if (c === "medium") return { label: "MEDIUM", tone: "accent" };
  return { label: "HIGH", tone: "warn" };
}

function LicensesSection({ placards }: { placards: RuntimePlacard[] }) {
  const seen = new Set<string>();
  const licenses: PublicArtifactLicense[] = [];
  for (const a of aggregateArtifacts(placards)) {
    const lic = a.license;
    if (!lic?.name) continue;
    const key = `${lic.name}::${lic.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    licenses.push(lic);
  }
  if (licenses.length === 0) return null;
  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— IV. LICENSES</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          —— {licenses.length} {licenses.length === 1 ? "LICENSE" : "LICENSES"} DETECTED
        </p>
      </header>
      <div className="resultCardGrid">
        {licenses.map((lic) => {
          const sev = licenseSeverity(lic.confidence);
          const preview =
            `Source: ${pretty(lic.source)} · Confidence ${pretty(lic.confidence)}`;
          return (
            <ResultCard
              key={`${lic.name}-${lic.url ?? ""}`}
              category="LICENSE"
              title={lic.name}
              preview={preview}
              footnote={sev.label}
              dotTone={sev.tone}
              href={lic.url ?? undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function EvalPlanSection({ placards }: { placards: RuntimePlacard[] }) {
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const p of placards) {
    for (const step of p.eval_plan ?? []) {
      if (!step || seen.has(step)) continue;
      seen.add(step);
      steps.push(step);
    }
  }
  if (steps.length === 0) return null;
  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— V. EVAL PLAN</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          —— {steps.length} {steps.length === 1 ? "STEP" : "STEPS"}
        </p>
      </header>
      <div className="resultCardGrid">
        {steps.map((step, idx) => (
          <ResultCard
            key={`eval-${idx}`}
            category={`STEP ${idx + 1}`}
            title={step}
            footnote="REQUIRED"
            dotTone="muted"
          />
        ))}
      </div>
    </section>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return "LINK";
  }
}

function SourceLinksSection({ placards }: { placards: RuntimePlacard[] }) {
  const seen = new Set<string>();
  const links: PublicSourceLink[] = [];
  for (const a of aggregateArtifacts(placards)) {
    for (const link of a.source_links ?? []) {
      if (!link?.url || seen.has(link.url)) continue;
      seen.add(link.url);
      links.push(link);
    }
  }
  if (links.length === 0) return null;
  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— VI. SOURCE LINKS</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          —— {links.length} {links.length === 1 ? "LINK" : "LINKS"}
        </p>
      </header>
      <div className="resultCardGrid">
        {links.map((link) => (
          <ResultCard
            key={link.url}
            category="SOURCE"
            title={link.label || link.url}
            preview={
              link.source_kind
                ? `From ${pretty(link.source_kind)}`
                : "External reference"
            }
            footnote={extractDomain(link.url)}
            href={link.url}
          />
        ))}
      </div>
    </section>
  );
}

function ModelPolicySection({ preview }: { preview: PublicPreview }) {
  const teacher = preview.calibration?.teacher;
  const students = preview.calibration?.students ?? [];
  if (!teacher && students.length === 0) return null;

  const title = teacher
    ? `${teacher.provider} / ${teacher.model} ranks the quality bundle`
    : "Backend-controlled model routing";
  const preview_text =
    preview.calibration?.public_serving_policy ??
    "Public preview routing controlled by backend policy.";

  const shadow = students.find((s) => !s.public_eligible) ?? students[0];
  const footnote = shadow
    ? `${shadow.provider} / ${shadow.model} ${
        shadow.public_eligible ? "PUBLIC ELIGIBLE" : "SHADOW ONLY"
      }`.toUpperCase()
    : undefined;

  return (
    <section className="resultSection">
      <header className="sectionHead">
        <p className="sectionKicker">—— II. RECOMMENDATION MODEL POLICY</p>
        <div className="sectionRule" aria-hidden="true" />
      </header>
      <ResultCard
        category="MODEL"
        title={title}
        preview={preview_text}
        footnote={footnote}
        dotTone={shadow ? (shadow.public_eligible ? "ok" : "muted") : "none"}
      />
    </section>
  );
}

type BackendStatus =
  | { state: "checking" }
  | { state: "ready"; env: string }
  | { state: "not_configured" }
  | { state: "unreachable"; detail: string };

const QUICK_START_CARDS = [
  {
    category: "ENGINEER",
    title: "Next.js engineer",
    preview: "Ships features end-to-end with GitHub PRs and Playwright tests.",
    footnote: "4 TOOLS · GITHUB · POSTGRES",
    prompt:
      "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.",
  },
  {
    category: "RESEARCH",
    title: "Paper analyst",
    preview:
      "Summarises PubMed papers, tracks citations, exports annotated PDFs.",
    footnote: "3 TOOLS · PUBMED · PDF",
    prompt:
      "Build a research assistant agent that summarises academic papers from PubMed, tracks citations across publications, and exports findings as annotated PDFs.",
  },
  {
    category: "SUPPORT",
    title: "Docs triager",
    preview:
      "Reads Notion runbooks and files Linear bugs from customer tickets.",
    footnote: "3 TOOLS · NOTION · LINEAR",
    prompt:
      "Build a customer support agent that reads our Notion docs, classifies inbound tickets, and files Linear bugs with reproduction steps.",
  },
  {
    category: "DATA",
    title: "Metric scout",
    preview:
      "Queries BigQuery, drafts weekly digests, flags anomalies in Slack.",
    footnote: "3 TOOLS · BIGQUERY · SLACK",
    prompt:
      "Build a data analyst agent that queries BigQuery for product metrics, writes a weekly Slack digest, and flags anomalies for review.",
  },
  {
    category: "OPS",
    title: "Oncall medic",
    preview:
      "Triages alerts, scans logs, summarises incidents into postmortems.",
    footnote: "3 TOOLS · DATADOG · PAGERDUTY",
    prompt:
      "Build an on-call response agent that triages Datadog alerts, scans recent logs for related errors, escalates via PagerDuty, and drafts a postmortem timeline after resolution.",
  },
  {
    category: "CONTENT",
    title: "Blog drafter",
    preview:
      "Researches a topic, drafts SEO posts, publishes to WordPress.",
    footnote: "3 TOOLS · WORDPRESS · SERP",
    prompt:
      "Build a content marketing agent that researches a topic across SERP results, drafts an SEO-optimised blog post in our brand voice, and publishes it as a draft to WordPress.",
  },
];

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<PromptRejection | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const startStackRef = useRef<HTMLDivElement | null>(null);
  const startThumbRafRef = useRef<number | null>(null);
  const [startScrolledEnd, setStartScrolledEnd] = useState(false);
  const [promptHasFocused, setPromptHasFocused] = useState(false);
  const [startThumb, setStartThumb] = useState<{ top: number; height: number; visible: boolean }>(
    { top: 0, height: 0, visible: false },
  );

  function computeStartThumb() {
    const el = startStackRef.current;
    if (!el) return;
    const visibleHeight = el.clientHeight;
    const contentHeight = el.scrollHeight;
    if (contentHeight <= visibleHeight + 1) {
      setStartThumb({ top: 0, height: 0, visible: false });
      return;
    }
    const railHeight = visibleHeight - 16;
    let h = Math.max(32, (visibleHeight / contentHeight) * railHeight);
    h = Math.min(h, railHeight);
    const denom = contentHeight - visibleHeight;
    const t = denom > 0 ? (el.scrollTop / denom) * (railHeight - h) : 0;
    setStartThumb({ top: t, height: h, visible: true });
  }

  function onStartStackScroll() {
    const el = startStackRef.current;
    if (!el) return;
    setStartScrolledEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
    if (startThumbRafRef.current != null) {
      cancelAnimationFrame(startThumbRafRef.current);
    }
    startThumbRafRef.current = requestAnimationFrame(computeStartThumb);
  }

  useEffect(() => {
    computeStartThumb();
    const onResize = () => computeStartThumb();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const verdict = useMemo(() => classifyPrompt(prompt), [prompt]);

  function updatePrompt(next: string) {
    setPrompt(next);
    if (rejection) setRejection(null);
    if (error) setError(null);
  }

  function useExamplePrompt(example: string) {
    setPrompt(example);
    setRejection(null);
    setError(null);
    requestAnimationFrame(() => {
      const el = promptRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(example.length, example.length);
      }
    });
  }
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

  const canBuild =
    backend.state === "ready" &&
    prompt.trim().length > 4 &&
    verdict !== "off_topic" &&
    !busy;

  async function build() {
    if (backend.state !== "ready" || busy) return;
    if (verdict === "off_topic") {
      setError(null);
      setPreview(null);
      setRejection(localRejection(prompt));
      requestAnimationFrame(() => promptRef.current?.focus());
      return;
    }
    setBusy(true);
    setError(null);
    setRejection(null);
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
      if (prompt.trim().length === 0) return;
      void build();
    }
  }

  const promptEmpty = prompt.trim().length === 0;
  const showEmptyHint = promptEmpty && promptHasFocused && !busy;

  const policy = preview?.source_policy;

  return (
    <main>
      <div
        className={`pageDecoration${preview ? " is-hidden" : ""}`}
        aria-hidden="true"
      >
        <div className="pageDecoShapes">
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <defs>
              <filter id="pageDecoTexture" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={2} seed={5} />
                <feDisplacementMap in="SourceGraphic" scale={4} />
              </filter>
            </defs>
            <g filter="url(#pageDecoTexture)">
              <path
                className="pageDecoShape pageDecoA"
                d="M -100 80 C -50 -60, 100 -100, 250 -80 C 380 -60, 480 30, 450 130 C 430 200, 380 250, 300 280 C 220 290, 130 270, 60 240 C -10 200, -80 160, -100 80 Z"
                fill="#9A4B33"
                opacity="0.32"
              />
              <path
                className="pageDecoShape pageDecoB"
                d="M 1150 -50 C 1280 -80, 1420 -40, 1500 30 C 1580 80, 1700 120, 1650 220 C 1610 300, 1450 280, 1330 250 C 1240 220, 1180 160, 1130 100 C 1100 50, 1110 0, 1150 -50 Z"
                fill="#C2674A"
                opacity="0.30"
              />
              <path
                className="pageDecoShape pageDecoC"
                d="M -50 380 C 30 360, 120 370, 180 410 C 220 440, 230 480, 200 520 C 170 555, 90 565, 30 540 C -30 520, -60 480, -50 440 C -60 420, -55 400, -50 380 Z"
                fill="#E08B6B"
                opacity="0.22"
              />
              <path
                className="pageDecoShape pageDecoD"
                d="M 1180 700 C 1280 660, 1420 660, 1500 700 C 1580 730, 1680 760, 1700 820 C 1700 880, 1620 940, 1500 960 C 1380 980, 1250 970, 1180 920 C 1120 870, 1100 800, 1130 760 C 1140 730, 1160 710, 1180 700 Z"
                fill="#9A4B33"
                opacity="0.32"
              />
              <path
                className="pageDecoShape pageDecoE"
                d="M -50 720 C 50 680, 180 670, 280 700 C 360 730, 420 800, 380 860 C 340 920, 220 940, 100 920 C 0 900, -80 860, -100 800 C -100 760, -80 730, -50 720 Z"
                fill="#C2674A"
                opacity="0.30"
              />
              <path
                className="pageDecoShape pageDecoF"
                d="M 820 40 C 850 20, 900 15, 940 30 C 970 45, 985 70, 970 95 C 955 115, 920 125, 880 120 C 840 115, 815 100, 810 80 C 805 65, 810 50, 820 40 Z"
                fill="#E08B6B"
                opacity="0.18"
              />
            </g>
          </svg>
        </div>
        <div className="pageDecoLines">
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <g fill="none" stroke="#E08B6B" strokeWidth={2} opacity="0.55">
              <path
                className="pageDecoLine pageDecoLine1"
                d="M 1500 50 C 1300 200, 1100 350, 800 400 C 500 450, 200 550, -50 600"
              />
              <path
                className="pageDecoLine pageDecoLine2"
                d="M -50 120 C 200 60, 600 90, 880 100 C 1180 110, 1400 180, 1700 100"
              />
              <path
                className="pageDecoLine pageDecoLine3"
                d="M 100 780 C 150 750, 220 770, 240 820 C 250 850, 230 880, 200 870"
              />
            </g>
          </svg>
        </div>
      </div>
      <header className="topbar">
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

      <div className="layoutGrid">
        <div className="layoutLeft">
          <div className="brandRow">
            <div className="mark" aria-hidden="true">
              M
            </div>
            <div className="brand">
              <span className="brandName">Matix Agent Builder</span>
              <span className="brandTag">Public preview / same-origin only</span>
            </div>
          </div>

          <section className="hero">
        <div className="heroBadges">Codex · Claude Code · OpenClaw</div>
        <h1>
          One prompt.
          <br />
          Three ready-to-use agents.
        </h1>
      </section>
        </div>
        <p className="heroLead">
          Describe the agent you need. The Matix cockpit returns source-linked
          skills, MCPs, evaluation plans, and safe example exports for Codex,
          Claude Code, and OpenClaw - side by side.
        </p>
        <div className="layoutLeftBottom">
        <div className="promptBox">
          <div className="promptHeader">
            <label htmlFor="prompt" className="promptLabel">
              Describe your agent
            </label>
            <span className="promptCount">{prompt.length}/1000</span>
          </div>
          <textarea
            id="prompt"
            ref={promptRef}
            value={prompt}
            maxLength={1000}
            onChange={(event) => updatePrompt(event.target.value)}
            onKeyDown={onPromptKeyDown}
            onFocus={() => setPromptHasFocused(true)}
            placeholder={samplePrompt}
            disabled={backend.state !== "ready"}
            readOnly={busy}
            data-busy={busy ? "true" : undefined}
            aria-invalid={rejection != null}
            aria-describedby={rejection ? "prompt-rejection" : undefined}
          />
          <div className="promptActions">
            {error && (
              <p className="promptErrorHint" role="alert">
                BUILD FAILED — TRY AGAIN
              </p>
            )}
            <p className="trustNote">
              No provider keys run in the browser. This page calls only
              same-origin <code>/api/public/*</code>. Exports are safe example
              files with placeholders.
            </p>
            {showEmptyHint && (
              <p className="promptEmptyHint">DESCRIBE YOUR AGENT TO BUILD</p>
            )}
            <div className="promptCta">
              <span className="kbd">Cmd/Ctrl + Enter</span>
              <button
                className={`primaryButton${busy ? " is-busy" : ""}`}
                onClick={build}
                disabled={!canBuild}
                aria-busy={busy}
                aria-label={busy ? "Building blueprint" : undefined}
              >
                <span className="primaryButtonLabel">
                  {busy ? "Building…" : "Build agent"}
                </span>
              </button>
            </div>
          </div>
        </div>
        </div>
        <aside className="layoutRight">
          <div className="startFromHeader">—— START FROM</div>
          <div className={`startFromScroll${busy ? " is-busy" : ""}`}>
          <div
            className="startFromStack"
            ref={startStackRef}
            onScroll={onStartStackScroll}
          >
            {QUICK_START_CARDS.map((card) => (
              <button
                key={card.category}
                type="button"
                className="startFromCard"
                onClick={() => useExamplePrompt(card.prompt)}
              >
                <span className="startFromCategory">{card.category}</span>
                <span className="startFromTitle">{card.title}</span>
                <span className="startFromPreview">{card.preview}</span>
                <span className="startFromFootnote">{card.footnote}</span>
              </button>
            ))}
          </div>
            <div className="startFromRail" aria-hidden="true">
              {startThumb.visible && (
                <div
                  className="startFromThumb"
                  style={{ top: `${startThumb.top}px`, height: `${startThumb.height}px` }}
                />
              )}
            </div>
          </div>
          <div
            className={`startFromHint${startScrolledEnd ? " is-end" : ""}`}
            aria-hidden="true"
          >
            —— SCROLL FOR MORE
          </div>
        </aside>
      </div>

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

      {rejection && (
        <div
          id="prompt-rejection"
          className="rejectionCard"
          role="alert"
          aria-live="polite"
        >
          <div className="rejectionHead">
            <span className="rejectionBadge">Not an agent request</span>
            <h3>{rejection.title}</h3>
          </div>
          <p className="rejectionMessage">{rejection.message}</p>
          {rejection.hint && (
            <p className="rejectionHint">{rejection.hint}</p>
          )}
          <div className="rejectionExamplesLabel">Try one of these:</div>
          <div className="rejectionExamples">
            {examplePrompts.map((ex) => (
              <button
                key={ex}
                type="button"
                className="rejectionExample"
                onClick={() => useExamplePrompt(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="banner banner-error" role="alert">
          <strong>Preview failed.</strong> {error}
        </div>
      )}

      {busy && (
        <section className="results" aria-busy="true" aria-live="polite">
          <header className="resultHeaderNew">
            <p className="resultKicker">—— BACKEND-APPROVED PREVIEW</p>
            <h2 className="resultPrompt resultPromptLoading">
              Composing three runtime blueprints…
            </h2>
          </header>
          <div className="placards">
            <PlacardSkeleton tone="codex" />
            <PlacardSkeleton tone="claude_code" />
            <PlacardSkeleton tone="openclaw" />
          </div>
        </section>
      )}

      {!busy && preview && (
        <section className="results" id="results">
          <header className="resultHeaderNew">
            <p className="resultKicker">—— BACKEND-APPROVED PREVIEW</p>
            <h2 className="resultPrompt">{preview.normalized_prompt}</h2>
            <p className="resultMetaLine">
              {preview.model.provider.toUpperCase()} / {preview.model.name.toUpperCase()}
              {" · "}
              {pretty(preview.selection_source ?? preview.model.status).toUpperCase()}
              {" · "}
              {new Date(preview.generated_at)
                .toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                .toUpperCase()}
              {" · "}
              {preview.placards.length} BLUEPRINTS
            </p>
          </header>

          <SourceStatusSection statuses={preview.source_statuses ?? []} />
          <ModelPolicySection preview={preview} />

          <BlueprintsSection placards={preview.placards} />
          <LicensesSection placards={preview.placards} />
          <EvalPlanSection placards={preview.placards} />
          <SourceLinksSection placards={preview.placards} />

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

      {preview && (
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
                    {value <= rating ? "\u2605" : "\u2606"}
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
      )}

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
