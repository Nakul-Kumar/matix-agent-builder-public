import type { ReactNode } from "react";
import { runtimeDescriptions, runtimeLabels } from "../data/publicBuilderContent";
import { formatScore, pretty, safeExternalHref } from "../lib/format";
import type { PublicArtifact, RuntimePlacard } from "../types";

function ArtifactRow({
  artifact,
  label,
}: {
  artifact: PublicArtifact;
  label: string;
}) {
  const licenseUrl = safeExternalHref(artifact.license?.url);
  return (
    <li className="artifactRow">
      <div className="artifactMain">
        <span className="rowLabel">{label}</span>
        <strong>{artifact.name}</strong>
        {artifact.description && <p>{artifact.description}</p>}
      </div>
      <div className="artifactAside">
        <span>fit {formatScore(artifact.match)}</span>
        <span>trust {formatScore(artifact.trust)}</span>
        {licenseUrl ? (
          <a href={licenseUrl} rel="noreferrer noopener" target="_blank">
            {artifact.license.name}
          </a>
        ) : (
          <span>{artifact.license?.name || "License pending"}</span>
        )}
      </div>
    </li>
  );
}

function DetailBlock({
  children,
  count,
  title,
}: {
  children: ReactNode;
  count?: number;
  title: string;
}) {
  return (
    <section className="detailBlock">
      <header className="detailHeader">
        <h3>{title}</h3>
        {typeof count === "number" && <span>{count}</span>}
      </header>
      {children}
    </section>
  );
}

export function BlueprintGrid({ placard }: { placard: RuntimePlacard }) {
  const tools = [...placard.mcps, ...placard.tools];
  const artifacts = [...placard.skills, ...tools];
  const warnings = [
    ...placard.warnings,
    ...artifacts.flatMap((artifact) => artifact.warnings ?? []),
  ];
  const credentialItems = artifacts.filter(
    (artifact) => artifact.credential_status !== "not_required",
  );
  const whySelected = artifacts.filter((artifact) => artifact.why_selected);

  return (
    <div className="blueprintGrid">
      <section className="blueprintCanvas" aria-label="Runtime summary">
        <div className="canvasHeader">
          <span className="eyebrow">
            {runtimeLabels[placard.platform] ?? placard.label}
          </span>
          <h2>{placard.label.replace(/\s+blueprint\s*$/i, "")}</h2>
          <p>{runtimeDescriptions[placard.platform]}</p>
        </div>
        <div className="scoreLedger" aria-label="Runtime scores">
          <span>
            <strong>{formatScore(placard.scores.trust)}</strong>
            trust
          </span>
          <span>
            <strong>{formatScore(placard.scores.match)}</strong>
            match
          </span>
          <span>
            <strong>{formatScore(placard.scores.performance)}</strong>
            quality
          </span>
          <span>
            <strong>{pretty(placard.memory_mode)}</strong>
            memory
          </span>
        </div>
        <div className="nodeRail" aria-label="Blueprint contents">
          <span>Skills {placard.skills.length}</span>
          <span>MCPs and tools {tools.length}</span>
          <span>Files {placard.file_tree.length}</span>
          <span>Eval steps {placard.eval_plan.length}</span>
        </div>
      </section>

      <aside className="blueprintInspector" aria-label="Runtime inspector">
        <DetailBlock count={placard.skills.length} title="Skills">
          {placard.skills.length ? (
            <ul className="artifactList">
              {placard.skills.map((artifact) => (
                <ArtifactRow
                  artifact={artifact}
                  key={`${placard.platform}-skill-${artifact.artifact_ref}`}
                  label="Skill"
                />
              ))}
            </ul>
          ) : (
            <p className="emptyHint">No skills were returned for this runtime.</p>
          )}
        </DetailBlock>

        <DetailBlock count={tools.length} title="MCPs and tools">
          {tools.length ? (
            <ul className="artifactList">
              {tools.map((artifact) => (
                <ArtifactRow
                  artifact={artifact}
                  key={`${placard.platform}-tool-${artifact.artifact_ref}`}
                  label={pretty(artifact.artifact_kind)}
                />
              ))}
            </ul>
          ) : (
            <p className="emptyHint">No MCPs or tools were returned.</p>
          )}
        </DetailBlock>

        <DetailBlock count={placard.file_tree.length} title="Generated files">
          {placard.file_tree.length ? (
            <div className="fileTree">
              {placard.file_tree.map((file) => (
                <code key={`${placard.platform}-${file}`}>{file}</code>
              ))}
            </div>
          ) : (
            <p className="emptyHint">No files in this example export.</p>
          )}
        </DetailBlock>

        {whySelected.length > 0 && (
          <DetailBlock count={whySelected.length} title="Why these choices">
            <ul className="rationaleList">
              {whySelected.slice(0, 6).map((artifact) => (
                <li key={`${placard.platform}-why-${artifact.artifact_ref}`}>
                  <strong>{artifact.name}</strong>
                  <span>{artifact.why_selected}</span>
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {credentialItems.length > 0 && (
          <DetailBlock count={credentialItems.length} title="Credential notes">
            <ul className="rationaleList">
              {credentialItems.map((artifact) => (
                <li key={`${placard.platform}-cred-${artifact.artifact_ref}`}>
                  <strong>{artifact.name}</strong>
                  <span>{pretty(artifact.credential_status)}</span>
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {warnings.length > 0 && (
          <DetailBlock count={warnings.length} title="Warnings">
            <ul className="warningList">
              {warnings.slice(0, 8).map((warning, index) => (
                <li key={`${placard.platform}-warning-${index}`}>{warning}</li>
              ))}
            </ul>
          </DetailBlock>
        )}
      </aside>
    </div>
  );
}
