import { formatModel, pretty } from "../lib/format";
import type { PublicPreview, PublicSourceStatus } from "../types";

function sourceKind(source: PublicSourceStatus): string {
  const haystack = `${source.source_id} ${source.label}`.toLowerCase();
  if (haystack.includes("registry")) return "Registry";
  if (haystack.includes("market")) return "Marketplace";
  if (haystack.includes("cache") || haystack.includes("mirror")) return "Mirror";
  return "Directory";
}

export function SourceStatusSection({
  preview,
  statuses,
}: {
  preview: PublicPreview;
  statuses: PublicSourceStatus[];
}) {
  const filtered = statuses.filter((status) => {
    const label = status.label.trim();
    if (/^search:/i.test(label)) return false;
    if (/pulse\s*mcp/i.test(`${status.source_id} ${label}`)) return false;
    if (/mcp\s*market/i.test(`${status.source_id} ${label}`)) return false;
    return true;
  });

  return (
    <section className="sourcePanel" aria-labelledby="sources-title">
      <header className="resultSectionHeader compact">
        <span className="eyebrow">Sources checked</span>
        <h2 id="sources-title">Directories checked</h2>
        <p>
          Model: {formatModel(preview.model.provider, preview.model.name)}.
          Reported by backend.
        </p>
      </header>
      {filtered.length ? (
        <div className="sourceList">
          {filtered.map((source) => (
            <div className="sourceRow" key={source.source_id}>
              <span>{sourceKind(source)}</span>
              <strong>{source.label}</strong>
              <p>{source.message || pretty(source.status)}</p>
              <em>{pretty(source.status)}</em>
            </div>
          ))}
        </div>
      ) : (
        <p className="emptyHint">No source status entries were returned.</p>
      )}
    </section>
  );
}
