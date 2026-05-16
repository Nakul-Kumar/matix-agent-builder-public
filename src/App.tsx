import { useMemo, useState } from "react";
import { exportAgent, previewAgent, sendFeedback } from "./lib/publicApi";
import type { PublicPreview, RuntimePlacard } from "./types";

const samplePrompt = "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.";

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score">
      <span>{label}</span>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}

function Placard({ placard, onExport }: { placard: RuntimePlacard; onExport: (platform: string) => void }) {
  return (
    <article className="placard" style={{ "--accent": placard.accent } as React.CSSProperties}>
      <div className="placardTop">
        <div>
          <p className="platform">{placard.platform.replace("_", " ")}</p>
          <h2>{placard.label}</h2>
        </div>
        <span className="status">{placard.status}</span>
      </div>
      <p className="model">{placard.model}</p>
      <div className="scores">
        <Score label="Trust" value={placard.scores.trust} />
        <Score label="Match" value={placard.scores.match} />
        <Score label="Use" value={placard.scores.popularity} />
        <Score label="Perf" value={placard.scores.performance} />
      </div>
      <div className="fileTree">
        {placard.file_tree.map((file) => (
          <code key={file}>{file}</code>
        ))}
      </div>
      <section>
        <h3>Skills</h3>
        <div className="chips">
          {placard.skills.map((skill) => (
            <span key={skill.artifact_ref}>{skill.name}</span>
          ))}
        </div>
      </section>
      <section>
        <h3>MCPs & tools</h3>
        <div className="chips muted">
          {[...placard.mcps, ...placard.tools].map((item) => (
            <span key={item.artifact_ref}>{item.name}</span>
          ))}
        </div>
      </section>
      <section>
        <h3>Source links</h3>
        <div className="links">
          {[...placard.skills, ...placard.mcps]
            .flatMap((item) => item.source_links)
            .slice(0, 4)
            .map((link) => (
              <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
        </div>
      </section>
      {placard.warnings.length > 0 && <p className="warning">{placard.warnings[0]}</p>}
      <button className="secondary" onClick={() => onExport(placard.platform)}>
        Export safe bundle
      </button>
    </article>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState(samplePrompt);
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(5);

  const policy = useMemo(() => preview?.source_policy, [preview]);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewAgent(prompt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(platform: string) {
    setError(null);
    try {
      const payload = await exportAgent(prompt, platform);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `matix-agent-${platform}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setError(null);
    try {
      await sendFeedback({
        prompt,
        prompt_hash: preview?.prompt_hash,
        rating,
        feedback,
        did_export: Boolean(exported),
      });
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback failed");
    }
  }

  return (
    <main>
      <section className="hero">
        <nav>
          <div className="mark">M</div>
          <span>Matix Agent Builder</span>
        </nav>
        <div className="heroGrid">
          <div>
            <h1>Turn one prompt into three agent runtime blueprints.</h1>
            <p>
              Compare Codex, Claude Code, and OpenClaw templates with source-linked skills, MCPs, scores, and safe exports.
            </p>
          </div>
          <div className="promptBox">
            <textarea value={prompt} maxLength={1000} onChange={(event) => setPrompt(event.target.value)} />
            <button onClick={build} disabled={busy}>
              {busy ? "Building..." : "Build agent"}
            </button>
            <p>No provider keys run in the browser. The public page calls only same-origin /api/public endpoints.</p>
          </div>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {preview && (
        <section className="results">
          <div className="resultHeader">
            <div>
              <p className="platform">backend-approved preview</p>
              <h2>{preview.normalized_prompt}</h2>
            </div>
            <span className="status">{preview.model.name} · {preview.model.status}</span>
          </div>
          <div className="placards">
            {preview.placards.map((placard) => (
              <Placard key={placard.platform} placard={placard} onExport={handleExport} />
            ))}
          </div>
          {policy && (
            <p className="policy">
              Secrets included: {String(policy.secrets_included)} · Browser provider calls: {String(policy.browser_provider_calls)}
            </p>
          )}
        </section>
      )}

      <section className="feedback">
        <div>
          <p className="platform">feedback</p>
          <h2>What would make this agent blueprint better?</h2>
        </div>
        <label>
          Rating
          <input type="number" min={1} max={5} value={rating} onChange={(event) => setRating(Number(event.target.value))} />
        </label>
        <textarea value={feedback} maxLength={2000} onChange={(event) => setFeedback(event.target.value)} placeholder="Tell us what was useful, missing, or confusing." />
        <button className="secondary" onClick={submitFeedback}>Send feedback</button>
      </section>
    </main>
  );
}
