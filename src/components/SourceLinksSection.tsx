import { extractDomain, pretty, safeExternalHref } from "../lib/format";
import type { PublicArtifact, PublicSourceLink, RuntimePlacard } from "../types";

function aggregateArtifacts(placards: RuntimePlacard[]): PublicArtifact[] {
  const seen = new Set<string>();
  const artifacts: PublicArtifact[] = [];
  for (const placard of placards) {
    for (const artifact of [
      ...placard.skills,
      ...placard.mcps,
      ...placard.tools,
    ]) {
      if (seen.has(artifact.artifact_ref)) continue;
      seen.add(artifact.artifact_ref);
      artifacts.push(artifact);
    }
  }
  return artifacts;
}

export function SourceLinksSection({
  placards,
}: {
  placards: RuntimePlacard[];
}) {
  const seen = new Set<string>();
  const links: PublicSourceLink[] = [];
  for (const artifact of aggregateArtifacts(placards)) {
    for (const link of artifact.source_links ?? []) {
      const safe = safeExternalHref(link.url);
      if (!safe || seen.has(safe)) continue;
      seen.add(safe);
      links.push({ ...link, url: safe });
    }
  }
  if (links.length === 0) return null;

  return (
    <section className="stackedSection" id="section-source-link">
      <header className="resultSectionHeader compact">
        <span className="eyebrow">Source evidence</span>
        <h2>{links.length} source links</h2>
      </header>
      <div className="linkList">
        {links.map((link) => (
          <a
            href={link.url}
            key={link.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            <span>{pretty(link.source_kind)}</span>
            <strong>{link.label || extractDomain(link.url)}</strong>
            <em>{extractDomain(link.url)}</em>
          </a>
        ))}
      </div>
    </section>
  );
}
