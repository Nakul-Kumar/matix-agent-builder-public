import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { runtimeLabels, type PlatformKey } from "../data/publicBuilderContent";
import { formatScore, pretty } from "../lib/format";
import type { RuntimePlacard } from "../types";

export function RuntimeTabs({
  activeRuntime,
  onActiveRuntimeChange,
  placards,
}: {
  activeRuntime: PlatformKey | null;
  onActiveRuntimeChange: (platform: PlatformKey) => void;
  placards: RuntimePlacard[];
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const availableKeys = placards.map((p) => p.platform);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentKey: PlatformKey,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const currentIndex = availableKeys.indexOf(currentKey);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextKey =
      availableKeys[
        (currentIndex + delta + availableKeys.length) % availableKeys.length
      ];
    if (!nextKey) return;
    onActiveRuntimeChange(nextKey);
    tabRefs.current[nextKey]?.focus();
  }

  return (
    <div className="runtimeTabs" role="tablist" aria-label="Runtime preview">
      {placards.map((placard) => {
        const active = placard.platform === activeRuntime;
        return (
          <button
            aria-controls={`runtime-panel-${placard.platform}`}
            aria-selected={active}
            className={`runtimeTab${active ? " runtimeTab-active" : ""}`}
            id={`runtime-tab-${placard.platform}`}
            key={placard.platform}
            onClick={() => onActiveRuntimeChange(placard.platform)}
            onKeyDown={(event) => handleKeyDown(event, placard.platform)}
            ref={(node) => {
              tabRefs.current[placard.platform] = node;
            }}
            role="tab"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            <span className="runtimeTabName">
              {runtimeLabels[placard.platform] ?? placard.label}
            </span>
            <span className="runtimeTabMeta">
              <span>{pretty(placard.status)}</span>
              <span>trust {formatScore(placard.scores.trust)}</span>
              <span>match {formatScore(placard.scores.match)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
