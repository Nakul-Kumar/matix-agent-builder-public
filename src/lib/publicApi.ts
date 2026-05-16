import type { PublicPreview } from "../types";

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
    throw new Error(await response.text());
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
