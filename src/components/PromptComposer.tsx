import type { KeyboardEvent, RefObject } from "react";
import { samplePrompt } from "../data/publicBuilderContent";
import type { PromptRejection } from "../lib/promptIntent";
import type { BackendStatus } from "../types";

export function PromptComposer({
  backend,
  busy,
  canPreview,
  error,
  examplePrompts,
  onBuild,
  onExamplePrompt,
  onFocus,
  onKeyDown,
  onPromptChange,
  prompt,
  promptRef,
  rejection,
  showEmptyHint,
}: {
  backend: BackendStatus;
  busy: boolean;
  canPreview: boolean;
  error: string | null;
  examplePrompts: string[];
  onBuild: () => void;
  onExamplePrompt: (prompt: string) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPromptChange: (prompt: string) => void;
  prompt: string;
  promptRef: RefObject<HTMLTextAreaElement | null>;
  rejection: PromptRejection | null;
  showEmptyHint: boolean;
}) {
  return (
    <section className="promptPanel" aria-labelledby="prompt-label">
      <div className="promptHeader">
        <label htmlFor="prompt" id="prompt-label">
          Agent request
        </label>
        <span
          className={`promptCount${
            prompt.length >= 950
              ? " promptCount-critical"
              : prompt.length >= 800
                ? " promptCount-warn"
                : ""
          }`}
        >
          {prompt.length}/1000
        </span>
      </div>

      <textarea
        aria-describedby={rejection ? "prompt-rejection" : undefined}
        aria-invalid={rejection != null}
        data-busy={busy ? "true" : undefined}
        id="prompt"
        maxLength={1000}
        onChange={(event) => onPromptChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={samplePrompt}
        readOnly={busy}
        ref={promptRef}
        value={prompt}
      />

      <div className="promptActions">
        {error && (
          <p className="promptErrorHint" role="alert">
            Preview failed. Try again.
          </p>
        )}
        {showEmptyHint && (
          <p className="promptEmptyHint">
            Write a sentence about the agent you want.
          </p>
        )}
        <div className="promptCta">
          <span className="kbd">Cmd/Ctrl + Enter</span>
          <button
            aria-busy={busy}
            className={`primaryButton${busy ? " is-busy" : ""}`}
            disabled={!canPreview}
            onClick={onBuild}
            type="button"
          >
            {busy ? "Preparing preview..." : "Preview agent"}
          </button>
        </div>
      </div>

      {rejection && (
        <div
          aria-live="polite"
          className="rejectionCard"
          id="prompt-rejection"
          role="alert"
        >
          <div className="rejectionHead">
            <span className="rejectionBadge">Not an agent request</span>
            <h2>{rejection.title}</h2>
          </div>
          <p>{rejection.message}</p>
          {rejection.hint && <p className="rejectionHint">{rejection.hint}</p>}
          <div className="rejectionExamplesLabel">Try one of these:</div>
          <div className="rejectionExamples">
            {examplePrompts.map((example) => (
              <button
                className="rejectionExample"
                key={example}
                onClick={() => onExamplePrompt(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
