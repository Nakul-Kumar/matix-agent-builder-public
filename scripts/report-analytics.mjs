import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function defaultLogPath() {
  if (process.env.MATIX_ANALYTICS_LOG) return process.env.MATIX_ANALYTICS_LOG;
  const prodPath = "/var/lib/matix-agent-builder/analytics.jsonl";
  if (existsSync(prodPath)) return prodPath;
  return path.resolve(process.cwd(), ".data", "analytics.jsonl");
}

function parseSince(value) {
  if (!value) return null;
  const match = /^(\d+)([hdw])$/.exec(value);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const ms =
      unit === "h"
        ? amount * 60 * 60 * 1000
        : unit === "d"
          ? amount * 24 * 60 * 60 * 1000
          : amount * 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function emptySummary(file, since) {
  return {
    file,
    since: since ? since.toISOString() : null,
    total_events: 0,
    counts: {
      preview: 0,
      export: 0,
      feedback: 0,
      registry_summary: 0,
      client_click: 0,
    },
    clicks: {},
    feedback: [],
    recent_prompts: [],
  };
}

function summarize(file, since) {
  const summary = emptySummary(file, since);
  if (!existsSync(file)) return summary;

  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = event.ts ? new Date(event.ts) : null;
    if (since && ts && ts < since) continue;

    summary.total_events += 1;
    const type = event.event_type || "unknown";
    summary.counts[type] = (summary.counts[type] || 0) + 1;

    if (type === "client_click") {
      const name = event.event_name || "unknown_click";
      summary.clicks[name] = (summary.clicks[name] || 0) + 1;
    }

    if ((type === "preview" || type === "export") && event.prompt_text) {
      summary.recent_prompts.push({
        ts: event.ts,
        event_type: type,
        prompt_hash: event.prompt_hash || null,
        selected_platform: event.selected_platform || null,
        prompt_text: event.prompt_text,
      });
    }

    if (type === "feedback") {
      summary.feedback.push({
        ts: event.ts,
        prompt_hash: event.prompt_hash || null,
        selected_platform: event.selected_platform || null,
        rating: event.rating ?? null,
        feedback: event.feedback || "",
        contact_email: event.contact_email || null,
        did_export: event.did_export ?? null,
        backend_stored: event.backend_stored ?? null,
      });
    }
  }

  summary.feedback = summary.feedback.slice(-50).reverse();
  summary.recent_prompts = summary.recent_prompts.slice(-50).reverse();
  return summary;
}

function printText(summary) {
  console.log("Matix Agent Builder analytics report");
  console.log(`File: ${summary.file}`);
  console.log(`Since: ${summary.since || "all time"}`);
  console.log("");
  console.log("Counts");
  for (const key of ["preview", "export", "feedback", "registry_summary", "client_click"]) {
    console.log(`- ${key}: ${summary.counts[key] || 0}`);
  }
  console.log("");
  console.log("Clicks");
  const clickEntries = Object.entries(summary.clicks).sort((a, b) => b[1] - a[1]);
  if (!clickEntries.length) console.log("- none");
  for (const [name, count] of clickEntries) {
    console.log(`- ${name}: ${count}`);
  }
  console.log("");
  console.log("Feedback");
  if (!summary.feedback.length) console.log("- none");
  for (const item of summary.feedback) {
    console.log(
      `- ${item.ts || "(unknown time)"} rating=${item.rating ?? "n/a"} platform=${item.selected_platform || "n/a"} exported=${item.did_export ?? "n/a"} stored_upstream=${item.backend_stored ?? "n/a"}`,
    );
    if (item.contact_email) console.log(`  email: ${item.contact_email}`);
    console.log(`  ${item.feedback}`);
  }
  console.log("");
  console.log("Recent Prompts");
  if (!summary.recent_prompts.length) console.log("- none");
  for (const item of summary.recent_prompts.slice(0, 20)) {
    console.log(`- ${item.ts || "(unknown time)"} ${item.event_type} ${item.selected_platform || ""}`);
    console.log(`  ${item.prompt_text}`);
  }
}

const file = path.resolve(argValue("--file") || defaultLogPath());
const since = parseSince(argValue("--since"));
const summary = summarize(file, since);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printText(summary);
}
