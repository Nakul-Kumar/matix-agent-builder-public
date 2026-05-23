import type { RuntimePlacard } from "../types";

export const repoUrl =
  "https://github.com/Nakul-Kumar/matix-agent-builder-public";

export const legalLinks = [
  { label: "Privacy", href: `${repoUrl}/blob/main/PRIVACY.md` },
  { label: "Terms", href: `${repoUrl}/blob/main/TERMS.md` },
  { label: "Security", href: `${repoUrl}/blob/main/SECURITY.md` },
  { label: "GitHub", href: repoUrl },
];

export const samplePrompt =
  "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.";

export type PlatformKey = RuntimePlacard["platform"];

export const runtimeLabels: Record<PlatformKey, string> = {
  codex: "Codex",
  claude_code: "Claude Code",
  openclaw: "OpenClaw",
};

export const runtimeDescriptions: Record<PlatformKey, string> = {
  codex: "Structured files for a Codex workflow.",
  claude_code: "Workspace notes for a Claude Code workflow.",
  openclaw: "Local-first files for an OpenClaw workflow.",
};

export type ExampleCard = {
  category: string;
  title: string;
  preview: string;
  footnote: string;
  prompt: string;
};

export const exampleCards: ExampleCard[] = [
  {
    category: "Engineering",
    title: "Next.js engineer",
    preview: "Opens GitHub PRs and runs Playwright checks.",
    footnote: "4 tools / GitHub / Postgres",
    prompt:
      "Build a software engineer agent for a Next.js app with GitHub, Postgres, and Playwright testing.",
  },
  {
    category: "Research",
    title: "Paper analyst",
    preview: "Reviews PubMed papers, tracks citations, and drafts notes.",
    footnote: "3 tools / PubMed / PDF",
    prompt:
      "Build a research assistant agent that summarizes academic papers from PubMed, tracks citations across publications, and exports findings as annotated PDFs.",
  },
  {
    category: "Support",
    title: "Docs triager",
    preview: "Reads Notion runbooks and files Linear issues from tickets.",
    footnote: "3 tools / Notion / Linear",
    prompt:
      "Build a customer support agent that reads Notion runbooks, answers product questions, and files Linear bugs when tickets show a product issue.",
  },
  {
    category: "Analytics",
    title: "Metrics digest",
    preview: "Checks warehouse metrics and posts a short daily summary.",
    footnote: "3 tools / BigQuery / Slack",
    prompt:
      "Build an analytics agent that checks BigQuery for revenue changes, summarizes the reasons, and posts a daily Slack digest for the growth team.",
  },
  {
    category: "Operations",
    title: "Incident helper",
    preview: "Checks logs, escalates via PagerDuty, and drafts a timeline.",
    footnote: "3 tools / Datadog / PagerDuty",
    prompt:
      "Build an incident helper agent that checks Datadog logs for related errors, escalates through PagerDuty, and drafts a postmortem timeline after resolution.",
  },
  {
    category: "Content",
    title: "Content draft",
    preview: "Researches a topic and prepares a WordPress draft.",
    footnote: "3 tools / WordPress / SERP",
    prompt:
      "Build a content marketing agent that researches a topic across SERP results, drafts an SEO-optimized blog post in our brand voice, and publishes it as a draft to WordPress.",
  },
];
