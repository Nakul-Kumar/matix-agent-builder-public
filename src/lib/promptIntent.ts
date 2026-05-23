export type PromptVerdict = "agent" | "ambiguous" | "off_topic";

export type PromptRejection = {
  source: "local" | "server";
  title: string;
  message: string;
  hint?: string;
};

export const examplePrompts: string[] = [
  "Build a research agent that finds and cites primary sources.",
  "Build a customer support agent that reads Notion docs and files Linear bugs.",
  "Build an agent for architecture of buildings with code lookups and precedent analysis.",
];

const AGENT_NOUNS = [
  "agent",
  "agents",
  "assistant",
  "assistants",
  "bot",
  "bots",
  "copilot",
  "copilots",
  "blueprint",
  "blueprints",
  "workflow",
  "workflows",
  "automation",
  "automations",
  "pipeline",
  "pipelines",
  "tool",
  "tools",
  "helper",
  "helpers",
  "monitor",
  "monitors",
  "notifier",
  "notifiers",
  "summarizer",
  "summarizers",
  "tracker",
  "trackers",
  "analyzer",
  "analyzers",
  "crawler",
  "crawlers",
  "scraper",
  "scrapers",
  "service",
  "services",
  "ai",
  "llm",
  "llms",
  "chatbot",
  "chatbots",
  "model",
  "models",
  "api",
  "apis",
];

const AGENT_VERBS = [
  "build",
  "create",
  "make",
  "design",
  "generate",
  "spin up",
  "set up",
  "scaffold",
  "ship",
  "need",
  "want",
  "prototype",
  "draft",
];

const CONVERSATIONAL_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|yo|sup|hola|howdy)[\s!,.?]*$/i,
  /^(good\s+(morning|afternoon|evening|night))[\s!,.?]*$/i,
  /^how\s+are\s+you[\s!,.?]*$/i,
  /^(what'?s\s+up|whats\s+up)[\s!,.?]*$/i,
  /^who\s+are\s+you[\s!,.?]*$/i,
  /^what'?s\s+your\s+name[\s!,.?]*$/i,
  /^are\s+you\s+(there|real|human|an?\s+ai)[\s!,.?]*$/i,
  /^thank\s*s?(\s+you)?[\s!,.?]*$/i,
  /^(ok|okay|cool|nice|great|lol|lmao|haha)[\s!,.?]*$/i,
];

const OFF_TOPIC_REQUESTS: RegExp[] = [
  /\b(tell|write|sing|recite)\s+(me\s+)?(a|an|the)?\s*(joke|jokes|poem|poems|story|stories|song|songs|rap|haiku|limerick)\b/i,
  /\bwhat(?:'s|\s+is)\s+(?:the\s+)?weather\b/i,
  /\bwhat\s+time\s+is\s+it\b/i,
  /\bwhat(?:'s|\s+is)\s+(?:the\s+|today'?s\s+)?date\b/i,
  /\bwhat\s+day\s+is\s+(?:it|today)\b/i,
  /\b(latest|today'?s)\s+(news|headlines|stock|stocks|score|scores)\b/i,
  /\bplay\s+(a\s+)?(song|music|video|game)\b/i,
  /\border\s+(me\s+)?(a\s+)?(pizza|food|uber|taxi)\b/i,
  /\b(translate|define|spell)\s+\w+/i,
  /\bdo\s+my\s+(homework|essay|assignment)\b/i,
];

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, " ").replace(/www\.\S+/gi, " ");
}

function isUrlOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /^https?:\/\/\S+$/i.test(t) || /^www\.\S+$/i.test(t);
}

function hasLetters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

function letterCount(text: string): number {
  const m = text.match(/[A-Za-z]/g);
  return m ? m.length : 0;
}

function wordCount(text: string): number {
  const m = text.trim().match(/[A-Za-z][A-Za-z'-]*/g);
  return m ? m.length : 0;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => {
    if (n.includes(" ")) return lower.includes(n);
    const re = new RegExp(`\\b${n}\\b`, "i");
    return re.test(lower);
  });
}

export function classifyPrompt(rawPrompt: string): PromptVerdict {
  const trimmed = (rawPrompt ?? "").trim();

  if (trimmed.length < 5) return "off_topic";
  if (isUrlOnly(trimmed)) return "off_topic";
  if (!hasLetters(trimmed)) return "off_topic";

  const lettersOnly = letterCount(trimmed);
  if (lettersOnly < 6) return "off_topic";

  const stripped = stripUrls(trimmed).trim();
  const words = wordCount(stripped);

  for (const re of CONVERSATIONAL_PATTERNS) {
    if (re.test(stripped)) return "off_topic";
  }

  for (const re of OFF_TOPIC_REQUESTS) {
    if (re.test(stripped)) return "off_topic";
  }

  if (words <= 2) return "off_topic";

  const hasAgentNoun = containsAny(stripped, AGENT_NOUNS);
  const hasAgentVerb = containsAny(stripped, AGENT_VERBS);

  if (hasAgentNoun && hasAgentVerb) return "agent";
  if (hasAgentNoun) return "agent";
  if (/\bagent\s+(for|that|to|which|who)\b/i.test(stripped)) return "agent";

  return "ambiguous";
}

export function localRejection(rawPrompt: string): PromptRejection {
  const trimmed = (rawPrompt ?? "").trim();
  let reason = "It doesn't describe an agent you'd like to build.";

  if (trimmed.length < 5 || letterCount(trimmed) < 6) {
    reason = "It's too short to describe an agent.";
  } else if (isUrlOnly(trimmed)) {
    reason = "It looks like just a URL with no description of what to build.";
  } else if (!hasLetters(trimmed)) {
    reason = "It doesn't contain any words I can read.";
  } else if (CONVERSATIONAL_PATTERNS.some((re) => re.test(stripUrls(trimmed).trim()))) {
    reason = "It looks like a greeting or chit-chat, not an agent description.";
  } else if (OFF_TOPIC_REQUESTS.some((re) => re.test(stripUrls(trimmed).trim()))) {
    reason = "This page only builds AI agent blueprints. It isn't a general assistant.";
  } else if (wordCount(stripUrls(trimmed)) <= 2) {
    reason = "That's too short. Write a sentence about the agent you want.";
  }

  return {
    source: "local",
    title: "This doesn't look like an agent request",
    message: reason,
    hint: "Say what the agent should do, who it's for, and which tools or sources it needs.",
  };
}
