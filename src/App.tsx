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
    accent: "#A24A26",
    accentSoft: "rgba(162, 74, 38, 0.12)",
    glow: "rgba(162, 74, 38, 0.18)",
    tag: "OpenAI / Codex CLI",
    subtitle: "Cool, technical, structured exports",
  },
  claude_code: {
    tone: "claude",
    accent: "#A24A26",
    accentSoft: "rgba(162, 74, 38, 0.12)",
    glow: "rgba(162, 74, 38, 0.18)",
    tag: "Anthropic / Claude Code",
    subtitle: "Warm, careful, citation-friendly",
  },
  openclaw: {
    tone: "openclaw",
    accent: "#A24A26",
    accentSoft: "rgba(162, 74, 38, 0.12)",
    glow: "rgba(162, 74, 38, 0.18)",
    tag: "Open source / OpenClaw",
    subtitle: "Experimental, local-first, opinionated",
  },
};

function pretty(value: string): string {
  return value.replace(/_/g, " ");
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
      <header className="anchorHead">
        <p className="anchorKicker">—— I. SOURCE SEARCH STATUS</p>
        <h2 className="anchorTitle">
          Directories and marketplaces checked
        </h2>
        <p className="anchorCount">
          —— {filtered.length}{" "}
          {filtered.length === 1 ? "DIRECTORY" : "DIRECTORIES"}
        </p>
        <div className="anchorRule" aria-hidden="true" />
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

type SectionNavItem = { id: string; index: string; label: string };

function SectionNav({ items }: { items: SectionNavItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const first = elements[0];
    const last = elements[elements.length - 1];

    function computeProgress() {
      const viewportAnchor = window.innerHeight * 0.35;
      const startY = first.getBoundingClientRect().top;
      const lastRect = last.getBoundingClientRect();
      const endY = lastRect.top + lastRect.height;
      const span = endY - startY;
      if (span <= 0) {
        setProgress(0);
        return;
      }
      const traveled = viewportAnchor - startY;
      const pct = Math.max(0, Math.min(1, traveled / span));
      setProgress(pct);
    }

    computeProgress();
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        computeProgress();
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
    setActiveId(id);
  }

  return (
    <nav className="sectionNav" aria-label="Sections">
      <div className="sectionNavProgressTrack" aria-hidden="true">
        <div
          className="sectionNavProgressFill"
          style={{ transform: `scaleY(${progress})` }}
        />
      </div>
      <ul className="sectionNavList">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`sectionNavItem ${isActive ? "sectionNavItemActive" : ""}`}
                onClick={() => scrollTo(item.id)}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="sectionNavIndex">{item.index}</span>
                <span className="sectionNavLabel">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BlueprintsSection({
  placards,
  activeRuntime,
  onActiveRuntimeChange,
  policy,
  exportingPlatform,
  exportedPlatforms,
  onExport,
  inspectingPlatform,
  onInspect,
}: {
  placards: RuntimePlacard[];
  activeRuntime: PlatformKey | null;
  onActiveRuntimeChange: (key: PlatformKey) => void;
  policy: PublicPreview["source_policy"] | null | undefined;
  exportingPlatform: string | null;
  exportedPlatforms: Set<string>;
  onExport: (platform: string) => void;
  inspectingPlatform: string | null;
  onInspect: (platform: string) => void;
}) {
  if (placards.length === 0) return null;

  const availableKeys = placards.map((p) => p.platform);
  const hasActive = activeRuntime !== null && availableKeys.includes(activeRuntime);
  const activeKey: PlatformKey | null = hasActive
    ? (activeRuntime as PlatformKey)
    : null;
  const activePlacard = activeKey
    ? placards.find((p) => p.platform === activeKey) ?? null
    : null;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [fadeKey, setFadeKey] = useState<string>(activeKey ?? "none");

  useEffect(() => {
    setFadeKey(activeKey ?? "none");
  }, [activeKey]);

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentKey: PlatformKey,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = availableKeys.indexOf(currentKey);
    if (idx < 0) {
      const fallback = availableKeys[0];
      if (fallback) {
        onActiveRuntimeChange(fallback);
        tabRefs.current[fallback]?.focus();
      }
      return;
    }
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextKey =
      availableKeys[(idx + delta + availableKeys.length) % availableKeys.length];
    onActiveRuntimeChange(nextKey);
    tabRefs.current[nextKey]?.focus();
  }

  return (
    <section className="resultSection" id="section-blueprint">
      <header className="anchorHead">
        <p className="anchorKicker">—— III. BLUEPRINTS</p>
        <h2 className="anchorTitle">Three runtimes ready to export</h2>
        <p className="anchorCount">—— {placards.length} RUNTIMES</p>
        <div className="anchorRule" aria-hidden="true" />
      </header>

      <div className="runtimeChoose">
        <h3 className="runtimeChooseTitle">Choose your runtime</h3>
        <p className="runtimeChooseSubtitle">Pick one to see the blueprint.</p>
      </div>
      <div
        className="runtimeTabs"
        role="tablist"
        aria-label="Runtime blueprint"
      >
        {placards.map((p) => {
          const isActive = activeKey !== null && p.platform === activeKey;
          const tabId = `runtime-tab-${p.platform}`;
          return (
            <button
              key={p.platform}
              ref={(el) => {
                tabRefs.current[p.platform] = el;
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={`runtime-panel-${p.platform}`}
              tabIndex={isActive ? 0 : -1}
              className={`runtimeTab${isActive ? " runtimeTabActive" : ""}`}
              onClick={() => onActiveRuntimeChange(p.platform)}
              onKeyDown={(e) => handleKeyDown(e, p.platform)}
            >
              <span className="runtimeTabTitle">
                {RUNTIME_DISPLAY_NAME[p.platform] ?? p.platform}
              </span>
              <span className="runtimeTabFootnote">
                <span
                  className={`resultDot resultDot--${placardStatusDotTone(p.status)}`}
                  aria-hidden="true"
                />
                <span className="runtimeTabFootnoteLabel">
                  {pretty(p.status).toUpperCase()}
                </span>
                <span className="runtimeTabFootnoteSep">·</span>
                <span className="runtimeTabFootnoteLabel">TRUST</span>
                <span className="runtimeTabFootnoteValue">
                  {Math.round(p.scores.trust)}
                </span>
                <span className="runtimeTabFootnoteSep">·</span>
                <span className="runtimeTabFootnoteLabel">MATCH</span>
                <span className="runtimeTabFootnoteValue">
                  {Math.round(p.scores.match)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeKey && activePlacard ? (
        <>
          <div className="exportActionRow">
            <p key={`meta-${fadeKey}`} className="exportActionMeta">
              <span className="exportActionProvider">
                {(platformTheme[activeKey]?.tag ?? activePlacard.label).toUpperCase()}
              </span>
              {policy && (
                <>
                  <span className="exportActionSep">·</span>
                  <span>
                    BROWSER PROVIDER CALLS {policy.browser_provider_calls ? "YES" : "NO"}
                  </span>
                  <span className="exportActionSep">·</span>
                  <span>
                    SECRETS INCLUDED {policy.secrets_included ? "YES" : "NO"}
                  </span>
                  <span className="exportActionSep">·</span>
                  <span>
                    ALLOWED SOURCE HOSTS {policy.allowed_source_hosts.length}
                  </span>
                </>
              )}
            </p>
            <div className="exportActionControls">
              <button
                type="button"
                className="exportActionInspect"
                onClick={() => onInspect(activeKey)}
                disabled={inspectingPlatform === activeKey}
                title="Open the raw JSON manifest in a new tab without downloading."
              >
                {inspectingPlatform === activeKey ? "OPENING…" : "VIEW JSON"}
              </button>
              <button
                type="button"
                className="exportActionButton"
                onClick={() => onExport(activeKey)}
                disabled={exportingPlatform === activeKey}
                title="Bundle is a signed JSON manifest. No secrets, no provider calls, source hosts allow-listed."
              >
                {exportingPlatform === activeKey
                  ? "PREPARING SAFE BUNDLE…"
                  : exportedPlatforms.has(activeKey)
                    ? "EXPORTED — DOWNLOAD AGAIN"
                    : "EXPORT SAFE BUNDLE"}
              </button>
            </div>
          </div>

          <div
            key={fadeKey}
            id={`runtime-panel-${activeKey}`}
            role="tabpanel"
            aria-labelledby={`runtime-tab-${activeKey}`}
            className="runtimePanel"
          >
            <BlueprintGroup placard={activePlacard} />
          </div>
        </>
      ) : (
        <p className="runtimeEmptyState" aria-live="polite">
          ↑ Select a runtime above to load its blueprint and export bundle.
        </p>
      )}
    </section>
  );
}

function BlueprintSubBox({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="blueprintBox">
      <div className="blueprintBoxHead">
        <p className="blueprintBoxKicker">—— {label}</p>
        <p className="blueprintBoxCount">{count} ITEMS</p>
        <div className="blueprintBoxRule" aria-hidden="true" />
      </div>
      <div className="blueprintBoxScroll">
        <div className="blueprintBoxRail" aria-hidden="true" />
        <div className="blueprintBoxStrip">{children}</div>
      </div>
    </div>
  );
}

function BlueprintGroup({ placard }: { placard: RuntimePlacard }) {
  const tools = [...placard.mcps, ...placard.tools];
  const whySelected = [...placard.skills, ...tools].filter(
    (a) => a.why_selected,
  );
  const categoryLabel =
    EXPORT_PLATFORMS.find((t) => t.key === placard.platform)?.label ??
    placard.platform.toUpperCase();
  const agentTitle = placard.label.replace(/\s+blueprint\s*$/i, "");

  return (
    <div className="blueprintGroup">
      <header className="activeBlueprintHead">
        <p className="activeBlueprintCategory">{categoryLabel}</p>
        <h3 className="activeBlueprintTitle">{agentTitle}</h3>
      </header>
      <div className="blueprintGrid">
        <BlueprintSubBox label="SKILLS" count={placard.skills.length}>
          {placard.skills.map((a) => (
            <ResultCard
              key={`${placard.platform}-skill-${a.artifact_ref}`}
              category="SKILL"
              title={a.name}
              preview={a.description}
              footnote={`${(a.license?.source ?? "SOURCE").toUpperCase()} · TASK FIT ${Math.round(a.match)} · QUALITY ${Math.round(a.performance)}`}
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="MCPS" count={tools.length}>
          {tools.map((a) => (
            <ResultCard
              key={`${placard.platform}-mcp-${a.artifact_ref}`}
              category="MCP"
              title={a.name}
              preview={a.description}
              footnote={`${(a.license?.source ?? "SOURCE").toUpperCase()} · TRUST ${Math.round(a.trust)} · QUALITY ${Math.round(a.performance)}`}
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="FILES" count={placard.file_tree.length}>
          {placard.file_tree.map((file) => (
            <ResultCard
              key={`${placard.platform}-file-${file}`}
              category="FILE"
              title={file}
              preview={`Included in the ${agentTitle} bundle`}
              footnote="EXPORTED"
              dotTone="muted"
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="REASONS" count={whySelected.length}>
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
        </BlueprintSubBox>
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
    <section className="resultSection" id="section-license">
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
    <section className="resultSection" id="section-eval-plan">
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
    <section className="resultSection" id="section-source-link">
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

const EXPORT_PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "codex", label: "CODEX" },
  { key: "claude_code", label: "CLAUDE CODE" },
  { key: "openclaw", label: "OPENCLAW" },
];

const RUNTIME_DISPLAY_NAME: Record<PlatformKey, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  openclaw: "OpenClaw",
};

function ModelPolicySection({ preview }: { preview: PublicPreview }) {
  const recommended = preview.model;
  const teacher = preview.calibration?.teacher;
  const students = preview.calibration?.students ?? [];

  const recKey = `${recommended.provider.toLowerCase()}/${recommended.name.toLowerCase()}`;
  type Alt = { provider: string; model: string; status: string };
  const alternatives: Alt[] = [];
  const seen = new Set<string>([recKey]);

  if (teacher) {
    const key = `${teacher.provider.toLowerCase()}/${teacher.model.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      alternatives.push({
        provider: teacher.provider,
        model: teacher.model,
        status: "RANKS QUALITY",
      });
    }
  }
  for (const s of students) {
    const key = `${s.provider.toLowerCase()}/${s.model.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push({
      provider: s.provider,
      model: s.model,
      status: s.public_eligible ? "FALLBACK" : "SHADOW ONLY",
    });
  }

  const policyText =
    preview.calibration?.public_serving_policy ??
    "Use the teacher/default model or deterministic fallback until a student model passes the latest golden prompt calibration run.";

  return (
    <section className="resultSection resultSection--model">
      <header className="modelSectionHead">
        <div className="modelSectionLockup">
          <span className="modelSectionKicker">II</span>
          <h2 className="modelSectionTitle">Recommended model</h2>
        </div>
      </header>

      <div className="recommendedModel">
        <p className="recommendedModelName">
          {recommended.provider.toLowerCase()} / {recommended.name.toLowerCase()}
        </p>
        <p className="recommendedModelTag">
          RECOMMENDED · DETERMINISTIC FALLBACK
        </p>
        <p className="recommendedModelPolicy">{policyText}</p>
      </div>

      <div className="alternativesBlock">
        <p className="alternativesHeader">—— ALTERNATIVES</p>
        {alternatives.length > 0 ? (
          <div className="alternativesRow">
            {alternatives.map((alt) => (
              <div
                key={`${alt.provider}/${alt.model}`}
                className="alternativePill"
              >
                <span className="alternativePillName">
                  {alt.provider.toLowerCase()} / {alt.model.toLowerCase()}
                </span>
                <span className="alternativePillStatus">{alt.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="alternativesEmpty">—— NO ALTERNATIVES CONFIGURED</p>
        )}
      </div>
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
  const [inspectingPlatform, setInspectingPlatform] = useState<string | null>(
    null,
  );
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(
    null,
  );
  const [activeRuntime, setActiveRuntime] = useState<PlatformKey | null>(null);

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

  async function handleInspect(platform: string) {
    if (inspectingPlatform) return;
    setError(null);
    setInspectingPlatform(platform);
    try {
      const payload = await exportAgent(prompt.trim(), platform);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspect failed");
    } finally {
      setInspectingPlatform(null);
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
        className="pageDecoration"
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
                fill="#9E8E70"
                opacity="0.32"
              />
              <path
                className="pageDecoShape pageDecoB"
                d="M 1150 -50 C 1280 -80, 1420 -40, 1500 30 C 1580 80, 1700 120, 1650 220 C 1610 300, 1450 280, 1330 250 C 1240 220, 1180 160, 1130 100 C 1100 50, 1110 0, 1150 -50 Z"
                fill="#B89684"
                opacity="0.30"
              />
              <path
                className="pageDecoShape pageDecoC"
                d="M -50 380 C 30 360, 120 370, 180 410 C 220 440, 230 480, 200 520 C 170 555, 90 565, 30 540 C -30 520, -60 480, -50 440 C -60 420, -55 400, -50 380 Z"
                fill="#7F9474"
                opacity="0.22"
              />
              <path
                className="pageDecoShape pageDecoD"
                d="M 1180 700 C 1280 660, 1420 660, 1500 700 C 1580 730, 1680 760, 1700 820 C 1700 880, 1620 940, 1500 960 C 1380 980, 1250 970, 1180 920 C 1120 870, 1100 800, 1130 760 C 1140 730, 1160 710, 1180 700 Z"
                fill="#C5A580"
                opacity="0.32"
              />
              <path
                className="pageDecoShape pageDecoE"
                d="M -50 720 C 50 680, 180 670, 280 700 C 360 730, 420 800, 380 860 C 340 920, 220 940, 100 920 C 0 900, -80 860, -100 800 C -100 760, -80 730, -50 720 Z"
                fill="#8A7565"
                opacity="0.30"
              />
              <path
                className="pageDecoShape pageDecoF"
                d="M 820 40 C 850 20, 900 15, 940 30 C 970 45, 985 70, 970 95 C 955 115, 920 125, 880 120 C 840 115, 815 100, 810 80 C 805 65, 810 50, 820 40 Z"
                fill="#9E8E70"
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
            <g fill="none" stroke="#A24A26" strokeWidth={2} opacity="0.55">
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
        <div className="heroMain">
          <p className="heroMeta">BUILD 0142 · MAY 2026 · MATIX</p>
          <div className="heroMetaRule" aria-hidden="true" />
          <h1>
            Describe your agent once.
            <br />
            <span className="heroHeadingMuted">
              Get three runtimes worth keeping.
            </span>
          </h1>
          <p className="heroDek">
            A prompt becomes a Codex bundle, a Claude Code workspace, and an
            OpenClaw runtime — each signed, scoped, and ready to ship. Pick
            one, or take all three.
          </p>
        </div>
        <aside className="heroSidebar" aria-label="Build details">
          <dl className="heroSidebarList">
            <div className="heroSidebarItem">
              <dt>Runtime targets</dt>
              <dd>03</dd>
            </div>
            <div className="heroSidebarItem">
              <dt>Avg build time</dt>
              <dd>7s</dd>
            </div>
            <div className="heroSidebarItem">
              <dt>Export format</dt>
              <dd>JSON</dd>
            </div>
            <div className="heroSidebarItem">
              <dt>License</dt>
              <dd>MIT</dd>
            </div>
            <div className="heroSidebarItem">
              <dt>Version</dt>
              <dd>0.4.1-preview</dd>
            </div>
          </dl>
        </aside>
      </section>

      <div className="layoutGrid">
        <div className="layoutLeftBottom">
        <div className="promptBox">
          <div className="promptHeader">
            <label htmlFor="prompt" className="promptLabel">
              Describe your agent
            </label>
            <span className={`promptCount${prompt.length >= 950 ? " promptCount--critical" : prompt.length >= 800 ? " promptCount--warn" : ""}`}>{prompt.length}/1000</span>
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
          <div className="startFromHeader">TRY AN EXAMPLE</div>
          <p className="startFromHelper">
            Click any card to drop it into your prompt — then edit freely.
          </p>
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
                <span className="startFromFootnoteRow">
                  <span className="startFromFootnote">{card.footnote}</span>
                  <span className="startFromUseThis" aria-hidden="true">
                    Use this →
                  </span>
                </span>
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

          <BlueprintsSection
            placards={preview.placards}
            activeRuntime={activeRuntime}
            onActiveRuntimeChange={setActiveRuntime}
            policy={policy}
            exportingPlatform={exportingPlatform}
            exportedPlatforms={exportedPlatforms}
            onExport={handleExport}
            inspectingPlatform={inspectingPlatform}
            onInspect={handleInspect}
          />
          {activeRuntime !== null && (
            <div className="bpNavGrid">
              <SectionNav
                items={[
                  { id: "section-blueprint", index: "01", label: "Blueprint" },
                  { id: "section-license", index: "02", label: "License" },
                  { id: "section-eval-plan", index: "03", label: "Eval plan" },
                  { id: "section-source-link", index: "04", label: "Source link" },
                ]}
              />
              <div className="bpNavContent">
                <LicensesSection placards={preview.placards} />
                <EvalPlanSection placards={preview.placards} />
                <SourceLinksSection placards={preview.placards} />
              </div>
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
