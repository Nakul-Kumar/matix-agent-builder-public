import type { PlatformKey } from "../data/publicBuilderContent";
import { formatGeneratedAt, formatModel, pretty } from "../lib/format";
import type { PublicPreview } from "../types";
import { BlueprintsSection } from "./BlueprintsSection";
import { EvalPlanSection } from "./EvalPlanSection";
import { SourceLinksSection } from "./SourceLinksSection";
import { SourceStatusSection } from "./SourceStatusSection";

function TileIcon({ kind }: { kind: "files" | "sources" | "eval" }) {
  if (kind === "files") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 2.5h6L13 6v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path d="M9 2.5V6h4" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === "sources") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6.5 9.5 9.5 6.5M5 8 3.5 9.5a2.12 2.12 0 1 0 3 3L8 11M11 8l1.5-1.5a2.12 2.12 0 1 0-3-3L8 5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="m5.5 8 2 2 3.5-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyCanvas() {
  return (
    <aside className="previewCanvas" id="results" aria-label="Preview canvas">
      <div className="canvasEmpty">
        <span className="eyebrow">Preview canvas</span>
        <h2>Your runtime draft will appear here.</h2>
        <p>
          Write an agent request on the left, then click{" "}
          <strong>Preview agent</strong>. This canvas fills with the runtime
          files, sources, and eval steps the backend drafts for you.
        </p>
        <div className="canvasPreviewTiles" aria-hidden="true">
          <div className="canvasTile">
            <span className="canvasTileLabel">
              <TileIcon kind="files" />
              Files
            </span>
            <strong>Runtime files</strong>
            <p>AGENTS.md, MCP configs, skill folders per platform.</p>
            <div className="canvasMockLines">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="canvasTile">
            <span className="canvasTileLabel">
              <TileIcon kind="sources" />
              Sources
            </span>
            <strong>Where each piece came from</strong>
            <p>Skills, MCPs, and runtime docs with license attribution.</p>
            <div className="canvasMockLines">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="canvasTile">
            <span className="canvasTileLabel">
              <TileIcon kind="eval" />
              Eval plan
            </span>
            <strong>What to test before shipping</strong>
            <p>Concrete checks per skill so you know it works.</p>
            <div className="canvasMockLines">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="canvasFooter">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Typical preview runs in 2-4 seconds.
        </div>
      </div>
    </aside>
  );
}

function LoadingCanvas() {
  return (
    <aside
      aria-busy="true"
      aria-live="polite"
      className="previewCanvas"
      id="results"
    >
      <div className="canvasLoading">
        <span className="eyebrow">Drafting</span>
        <h2>Drafting your agent...</h2>
        <p>Matix is talking to the public backend and shaping the runtime.</p>
        <div className="shimmerStack" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </aside>
  );
}

function ModelRunNotice({ preview }: { preview: PublicPreview }) {
  const selectionSource =
    preview.selection_source ||
    preview.model_trace_summary?.selection_source ||
    preview.model.status;

  return (
    <div className="modelRunNotice" aria-label="Model routing status">
      <span>
        Actual selection source: <strong>{pretty(selectionSource)}</strong>
      </span>
      <span>
        Model target:{" "}
        <strong>{formatModel(preview.model.provider, preview.model.name)}</strong>
      </span>
      <span>
        Status: <strong>{pretty(preview.model.status)}</strong>
      </span>
    </div>
  );
}

export function ResultsView({
  activeRuntime,
  busy,
  exportedPlatforms,
  exportingPlatform,
  inspectingPlatform,
  onActiveRuntimeChange,
  onExport,
  onInspect,
  preview,
}: {
  activeRuntime: PlatformKey | null;
  busy: boolean;
  exportedPlatforms: Set<string>;
  exportingPlatform: string | null;
  inspectingPlatform: string | null;
  onActiveRuntimeChange: (platform: PlatformKey) => void;
  onExport: (platform: string) => void;
  onInspect: (platform: string) => void;
  preview: PublicPreview | null;
}) {
  if (busy) return <LoadingCanvas />;
  if (!preview) return <EmptyCanvas />;

  return (
    <section className="resultsView" id="results" aria-labelledby="results-title">
      <header className="resultsHeader">
        <span className="eyebrow">Backend preview</span>
        <h2 id="results-title">{preview.normalized_prompt}</h2>
        <p>
          {formatModel(preview.model.provider, preview.model.name)} /{" "}
          {formatGeneratedAt(preview.generated_at)} /{" "}
          {preview.placards.length} runtime drafts
        </p>
        <ModelRunNotice preview={preview} />
      </header>

      <SourceStatusSection
        preview={preview}
        statuses={preview.source_statuses ?? []}
      />

      <BlueprintsSection
        activeRuntime={activeRuntime}
        exportedPlatforms={exportedPlatforms}
        exportingPlatform={exportingPlatform}
        inspectingPlatform={inspectingPlatform}
        onActiveRuntimeChange={onActiveRuntimeChange}
        onExport={onExport}
        onInspect={onInspect}
        placards={preview.placards}
        policy={preview.source_policy}
      />

      <EvalPlanSection placards={preview.placards} />
      <SourceLinksSection placards={preview.placards} />
    </section>
  );
}
