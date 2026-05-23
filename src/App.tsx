import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    accent: "#8A9A5B",
    accentSoft: "rgba(138, 154, 91, 0.12)",
    glow: "rgba(138, 154, 91, 0.18)",
    tag: "OpenAI / Codex CLI",
    subtitle: "Cool, technical, structured exports",
  },
  claude_code: {
    tone: "claude",
    accent: "#8A9A5B",
    accentSoft: "rgba(138, 154, 91, 0.12)",
    glow: "rgba(138, 154, 91, 0.18)",
    tag: "Anthropic / Claude Code",
    subtitle: "Warm, careful, citation-friendly",
  },
  openclaw: {
    tone: "openclaw",
    accent: "#8A9A5B",
    accentSoft: "rgba(138, 154, 91, 0.12)",
    glow: "rgba(138, 154, 91, 0.18)",
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
  if (/registry/.test(haystack)) return "Registry";
  if (/market|marketplace|store/.test(haystack)) return "Marketplace";
  if (/mirror|cache/.test(haystack)) return "Mirror";
  return "Directory";
}

function sourceStatusDotTone(status: string): ResultCardDotTone {
  const s = status.toLowerCase();
  if (s === "synced" || s === "searched" || s === "ok") return "ok";
  if (s === "auth_required" || s === "rate_limited") return "accent";
  return "muted";
}

function SourceStatusSection({
  statuses,
  preview,
}: {
  statuses: PublicSourceStatus[];
  preview: PublicPreview;
}) {
  const filtered = statuses.filter(
    (s) => !/^search:/i.test(s.label.trim()),
  );
  if (filtered.length === 0) return null;

  const recommended = { provider: "gemini", name: "gemini-2.5-flash" };

  return (
    <section className="resultSection">
      <header className="anchorHead">
        <p className="anchorKicker">Source search</p>
        <h2 className="anchorTitle">
          Directories and marketplaces checked
        </h2>
        <p className="anchorCount">
          {filtered.length}{" "}
          {filtered.length === 1 ? "directory" : "directories"}
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
            footnote={
              <span
                className={`statusText statusText--${sourceStatusDotTone(source.status)}`}
              >
                {pretty(source.status)}
              </span>
            }
          />
        ))}
      </div>
      <div className="modelStrip">
        <div className="modelStripRow modelStripRow--recommended">
          <span className="modelStripBadge modelStripBadge--recommended">
            Model
          </span>
          <span className="modelStripValue modelStripValue--primary">
            Gemini
          </span>
          <span className="modelStripCaption">Used to build your agent</span>
        </div>
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
        <p className="anchorKicker">Blueprints</p>
        <h2 className="anchorTitle">Three runtimes ready to export</h2>
        <p className="anchorCount">{placards.length} runtimes</p>
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
                  className={`statusText statusText--${placardStatusDotTone(p.status)}`}
                >
                  {pretty(p.status)}
                </span>
                <span className="runtimeTabFootnoteSep">·</span>
                <span className="runtimeTabFootnoteLabel">trust</span>
                <span className="runtimeTabFootnoteValue">
                  {Math.round(p.scores.trust)}
                </span>
                <span className="runtimeTabFootnoteSep">·</span>
                <span className="runtimeTabFootnoteLabel">match</span>
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
                {platformTheme[activeKey]?.tag ?? activePlacard.label}
              </span>
              {policy && (
                <>
                  <span className="exportActionSep">·</span>
                  <span>
                    No browser provider calls
                  </span>
                  <span className="exportActionSep">·</span>
                  <span>
                    No secrets bundled
                  </span>
                  <span className="exportActionSep">·</span>
                  <span>
                    {policy.allowed_source_hosts.length} allow-listed hosts
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
                {inspectingPlatform === activeKey ? "Opening…" : "View JSON"}
              </button>
              <button
                type="button"
                className="exportActionButton"
                onClick={() => onExport(activeKey)}
                disabled={exportingPlatform === activeKey}
                title="Bundle is a signed JSON manifest. No secrets, no provider calls, source hosts allow-listed."
              >
                {exportingPlatform === activeKey
                  ? "Preparing safe bundle…"
                  : exportedPlatforms.has(activeKey)
                    ? "Exported. Download again."
                    : "Export safe bundle"}
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
  const stripRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [maskState, setMaskState] = useState<"top" | "middle" | "bottom" | "none">("none");

  const update = useCallback(() => {
    const strip = stripRef.current;
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!strip) return;

    const { scrollTop, scrollHeight, clientHeight } = strip;
    const overflow = scrollHeight > clientHeight + 1;

    if (!overflow) {
      setMaskState("none");
      if (thumb) thumb.style.opacity = "0";
      return;
    }

    const atTop = scrollTop <= 2;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
    setMaskState(atTop ? "bottom" : atBottom ? "top" : "middle");

    if (rail && thumb) {
      const railH = rail.clientHeight;
      const thumbH = Math.max(24, (clientHeight / scrollHeight) * railH);
      const maxThumbTop = Math.max(0, railH - thumbH);
      const denom = Math.max(1, scrollHeight - clientHeight);
      const thumbTop = (scrollTop / denom) * maxThumbTop;
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
      thumb.style.opacity = "1";
    }
  }, []);

  useEffect(() => {
    update();
    const strip = stripRef.current;
    if (!strip) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };
    strip.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => update());
    ro.observe(strip);
    return () => {
      strip.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [update]);

  return (
    <div className="blueprintBox">
      <div className="blueprintBoxHead">
        <p className="blueprintBoxKicker">{label}</p>
        <p className="blueprintBoxCount">{count} {count === 1 ? "item" : "items"}</p>
        <div className="blueprintBoxRule" aria-hidden="true" />
      </div>
      <div className="blueprintBoxScroll">
        <div className="blueprintBoxRail" aria-hidden="true" ref={railRef}>
          <div className="blueprintBoxThumb" ref={thumbRef} />
        </div>
        <div
          className={`blueprintBoxStrip blueprintBoxStrip--mask-${maskState}`}
          ref={stripRef}
        >
          {children}
        </div>
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
        <BlueprintSubBox label="Skills" count={placard.skills.length}>
          {placard.skills.map((a) => (
            <ResultCard
              key={`${placard.platform}-skill-${a.artifact_ref}`}
              category="Skill"
              title={a.name}
              preview={a.description}
              footnote={`${a.license?.source ?? "source"} · fit ${Math.round(a.match)} · quality ${Math.round(a.performance)}`}
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="MCPs" count={tools.length}>
          {tools.map((a) => (
            <ResultCard
              key={`${placard.platform}-mcp-${a.artifact_ref}`}
              category="MCP"
              title={a.name}
              preview={a.description}
              footnote={`${a.license?.source ?? "source"} · trust ${Math.round(a.trust)} · quality ${Math.round(a.performance)}`}
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="Files" count={placard.file_tree.length}>
          {placard.file_tree.map((file) => (
            <ResultCard
              key={`${placard.platform}-file-${file}`}
              category="File"
              title={file}
              preview={`Included in the ${agentTitle} bundle`}
              footnote="Exported"
            />
          ))}
        </BlueprintSubBox>
        <BlueprintSubBox label="Reasons" count={whySelected.length}>
          {whySelected.map((a) => (
            <ResultCard
              key={`${placard.platform}-why-${a.artifact_ref}`}
              category="Reason"
              title={a.name}
              preview={a.why_selected}
              footnote={<span className="statusText statusText--accent">Matched</span>}
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
        <p className="sectionKicker">Evaluation plan</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </p>
      </header>
      <div className="resultCardGrid">
        {steps.map((step, idx) => (
          <ResultCard
            key={`eval-${idx}`}
            category={`Step ${idx + 1}`}
            title={step}
            footnote="Required"
          />
        ))}
      </div>
    </section>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
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
        <p className="sectionKicker">Source links</p>
        <div className="sectionRule" aria-hidden="true" />
        <p className="sectionSubtitle">
          {links.length} {links.length === 1 ? "link" : "links"}
        </p>
      </header>
      <div className="resultCardGrid">
        {links.map((link) => (
          <ResultCard
            key={link.url}
            category="Source"
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
    verdict === "agent" &&
    !busy;

  async function build() {
    if (backend.state !== "ready" || busy) return;
    if (verdict !== "agent") {
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
        <div className="pageDecoLines">
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <g className="pageDecoLines" fill="none" strokeWidth={2} opacity="0.55">
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
          <p className="heroMeta">Build 0142 / May 2026 / Matix</p>
          <div className="heroMetaRule" aria-hidden="true" />
          <h1>
            Describe an{" "}
            <span className="heroAccentWord">
              agent
              <svg
                className="heroAccentMark"
                viewBox="0 0 220 18"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M 4 12 C 28 6, 54 14, 82 9 C 112 4, 138 13, 168 8 C 188 6, 204 11, 216 8" />
              </svg>
            </span>{" "}
            in plain English.
            <br />
            <span className="heroHeadingMuted">
              Get a Codex, Claude Code, and OpenClaw bundle in about seven
              seconds.
            </span>
          </h1>
          <p className="heroDek">
            We compose the skills, MCPs, files, and an evaluation plan. The
            export is a signed JSON manifest with no secrets and no live
            provider calls.
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
                Build failed. Try again.
              </p>
            )}
            <p className="trustNote">
              No provider keys run in the browser. This page calls only
              same-origin <code>/api/public/*</code>. Exports are safe example
              files with placeholders.
            </p>
            {showEmptyHint && (
              <p className="promptEmptyHint">Write a sentence about the agent you want.</p>
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
          <div className="startFromHeader">Try an example</div>
          <p className="startFromHelper">
            Tap a card to fill the prompt. You can edit before building.
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
            Scroll for more
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
            <p className="resultKicker">Preview from the backend</p>
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
            <p className="resultKicker">Preview from the backend</p>
            <h2 className="resultPrompt">{preview.normalized_prompt}</h2>
            <p className="resultMetaLine">
              <code className="resultMetaMono">gemini-2.5-flash</code>
              {" / "}
              {new Date(preview.generated_at).toLocaleString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" / "}
              {preview.placards.length} blueprints
            </p>
          </header>

          <SourceStatusSection
            statuses={preview.source_statuses ?? []}
            preview={preview}
          />

          <div className={`bpNavGrid${activeRuntime !== null ? "" : " bpNavGrid--solo"}`}>
            <SectionNav
              items={[
                { id: "section-blueprint", index: "01", label: "Blueprint" },
                { id: "section-eval-plan", index: "02", label: "Eval plan" },
                { id: "section-source-link", index: "03", label: "Source link" },
              ]}
            />
            <div className="bpNavContent">
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
                <>
                  <EvalPlanSection placards={preview.placards} />
                  <SourceLinksSection placards={preview.placards} />
                </>
              )}
            </div>
          </div>
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
