import type { PublicPreview } from "../types";
import type { PromptRejection } from "./promptIntent";

export class PromptRejectedError extends Error {
  rejection: PromptRejection;
  constructor(rejection: PromptRejection) {
    super(rejection.message);
    this.name = "PromptRejectedError";
    this.rejection = rejection;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Same-origin only. Model/provider keys live behind /api/public on the server,
  // never in Vite env vars or browser JavaScript.
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    // Try to detect a structured rejection from the cockpit
    // (e.g. { ok: false, error_code: "not_agent_request", message, hint }).
    const text = await response.text();
    if (response.status >= 400 && response.status < 500) {
      try {
        const parsed = JSON.parse(text) as {
          ok?: boolean;
          error_code?: string;
          message?: string;
          hint?: string;
        };
        if (
          parsed &&
          typeof parsed.error_code === "string" &&
          typeof parsed.message === "string"
        ) {
          if (
            parsed.error_code === "not_agent_request" ||
            parsed.error_code === "off_topic_prompt" ||
            parsed.error_code === "prompt_rejected"
          ) {
            throw new PromptRejectedError({
              source: "server",
              title: "This doesn't look like an agent request",
              message: parsed.message,
              hint: parsed.hint,
            });
          }
        }
      } catch (err) {
        if (err instanceof PromptRejectedError) throw err;
        // fall through to generic error
      }
    }
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function previewAgent(prompt: string): Promise<PublicPreview> {
  return requestJson<PublicPreview>("/api/public/agent-builder/preview", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export function exportAgent(prompt: string, platform: string): Promise<{ files: Record<string, string>; manifest: unknown }> {
  return requestJson("/api/public/agent-builder/export", {
    method: "POST",
    body: JSON.stringify({ prompt, platform }),
  });
}

export function sendFeedback(input: {
  prompt_hash?: string;
  prompt?: string;
  rating: number;
  feedback: string;
  email?: string;
  platform?: string;
  did_export?: boolean;
}): Promise<{ ok: boolean; feedback_id: string }> {
  return requestJson("/api/public/agent-builder/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
