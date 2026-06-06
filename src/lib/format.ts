export function pretty(value?: string | null): string {
  return (value || "unknown").replace(/_/g, " ");
}

export function formatScore(value?: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.max(0, Math.min(100, Math.round(value ?? 0))));
}

export function formatModel(provider?: string, name?: string): string {
  const parts = [provider, name].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length ? parts.join(" / ") : "model reported by backend";
}

export function formatGeneratedAt(value?: string | null): string {
  if (!value) return "time reported by backend";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time reported by backend";
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    " UTC",
  ].join("");
}

export function safeExternalHref(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function extractDomain(url?: string | null): string {
  const safe = safeExternalHref(url);
  if (!safe) return "external link";
  try {
    return new URL(safe).hostname.replace(/^www\./, "");
  } catch {
    return "external link";
  }
}
