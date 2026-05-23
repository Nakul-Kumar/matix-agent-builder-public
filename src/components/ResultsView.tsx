import type { PlatformKey } from "../data/publicBuilderContent";
import { formatGeneratedAt, formatModel } from "../lib/format";
import type { PublicPreview } from "../types";
import { BlueprintsSection } from "./BlueprintsSection";
import { EvalPlanSection } from "./EvalPlanSection";
import { SourceLinksSection } from "./SourceLinksSection";
import { SourceStatusSection } from "./SourceStatusSection";

function EmptyCanvas() {
  return (
    <aside className="previewCanvas" id="results" aria-label="Preview canvas">
      <div className="canvasEmpty">
        <span className="eyebrow">Preview canvas</span>
        <h2>Your runtime draft will appear here.</h2>
        <p>
          Write an agent request, preview it, then inspect the runtime files,
          sources, eval steps, and example JSON export.
        </p>
        <div className="canvasChecklist" aria-label="Preview steps">
          <span>Prompt</span>
          <span>Preview</span>
          <span>Inspect</span>
          <span>Download JSON</span>
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
      <div className="canvasEmpty">
        <span className="eyebrow">Backend preview</span>
        <h2>Preparing runtime previews...</h2>
        <p>Matix is requesting the public backend and waiting for a draft.</p>
        <div className="skeletonStack" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </aside>
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
