import type { PublicExport, PublicHealth, PublicPreview } from "../types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Same-origin only. Model/provider keys live behind /api/public on the server,
  // never in Vite env vars or browser JavaScript.
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed.detail || parsed.error || text;
    } catch {
      // keep raw text
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Unexpected response from server");
  }
}

export function getHealth(): Promise<PublicHealth> {
  return requestJson<PublicHealth>("/api/health");
}

export function previewAgent(prompt: string): Promise<PublicPreview> {
  return requestJson<PublicPreview>("/api/public/agent-builder/preview", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export function exportAgent(prompt: string, platform: string): Promise<PublicExport> {
  return requestJson<PublicExport>("/api/public/agent-builder/export", {
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
