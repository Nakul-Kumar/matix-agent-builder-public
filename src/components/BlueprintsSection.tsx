import type { PlatformKey } from "../data/publicBuilderContent";
import { pretty } from "../lib/format";
import type { PublicPreview, RuntimePlacard } from "../types";
import { BlueprintGrid } from "./BlueprintGrid";
import { RuntimeTabs } from "./RuntimeTabs";

export function BlueprintsSection({
  activeRuntime,
  exportedPlatforms,
  exportingPlatform,
  inspectingPlatform,
  onActiveRuntimeChange,
  onExport,
  onInspect,
  placards,
  policy,
}: {
  activeRuntime: PlatformKey | null;
  exportedPlatforms: Set<string>;
  exportingPlatform: string | null;
  inspectingPlatform: string | null;
  onActiveRuntimeChange: (platform: PlatformKey) => void;
  onExport: (platform: string) => void;
  onInspect: (platform: string) => void;
  placards: RuntimePlacard[];
  policy: PublicPreview["source_policy"] | null | undefined;
}) {
  if (placards.length === 0) return null;
  const activePlacard =
    placards.find((placard) => placard.platform === activeRuntime) ??
    placards[0];

  return (
    <section className="blueprintSection" id="section-blueprint">
      <header className="resultSectionHeader">
        <span className="eyebrow">Runtime drafts</span>
        <h2>Review one runtime at a time</h2>
        <p>
          Each tab keeps the same shape: summary, skills, MCPs, files, eval
          plan, sources, and export controls.
        </p>
      </header>

      <RuntimeTabs
        activeRuntime={activePlacard.platform}
        onActiveRuntimeChange={onActiveRuntimeChange}
        placards={placards}
      />

      <div className="exportBar">
        <p>
          <strong>{pretty(activePlacard.status)}</strong>
          {policy && (
            <>
              <span>No browser provider calls</span>
              <span>No secrets included</span>
              <span>
                {policy.allowed_source_hosts.length} allowed source hosts
              </span>
            </>
          )}
        </p>
        <div className="exportControls">
          <button
            className="secondaryButton"
            disabled={inspectingPlatform === activePlacard.platform}
            onClick={() => onInspect(activePlacard.platform)}
            title="Open the example JSON manifest in a new tab without downloading."
            type="button"
          >
            {inspectingPlatform === activePlacard.platform
              ? "Opening..."
              : "View JSON"}
          </button>
          <button
            className="primaryButton primaryButton-compact"
            disabled={exportingPlatform === activePlacard.platform}
            onClick={() => onExport(activePlacard.platform)}
            title="Example JSON export. No secrets, no provider calls, source hosts allow-listed."
            type="button"
          >
            {exportingPlatform === activePlacard.platform
              ? "Preparing JSON..."
              : exportedPlatforms.has(activePlacard.platform)
                ? "Downloaded. Download again"
                : "Download example JSON"}
          </button>
        </div>
      </div>

      <div
        className="runtimePanel"
        id={`runtime-panel-${activePlacard.platform}`}
        role="tabpanel"
        aria-labelledby={`runtime-tab-${activePlacard.platform}`}
      >
        <BlueprintGrid placard={activePlacard} />
      </div>
    </section>
  );
}
