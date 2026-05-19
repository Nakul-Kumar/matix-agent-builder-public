export interface PublicSourceLink {
  label: string;
  url: string;
  source_kind: string;
}

export interface PublicArtifact {
  artifact_ref: string;
  artifact_kind: string;
  name: string;
  description: string;
  trust: number;
  popularity: number;
  match: number;
  performance: number;
  source_links: PublicSourceLink[];
}

export type RuntimePlatform = "codex" | "claude_code" | "openclaw";

export interface RuntimePlacard {
  platform: RuntimePlatform;
  label: string;
  model: string;
  status: string;
  accent: string;
  file_tree: string[];
  main_files: Record<string, string>;
  skills: PublicArtifact[];
  mcps: PublicArtifact[];
  tools: PublicArtifact[];
  memory_mode: string;
  eval_plan: string[];
  scores: {
    trust: number;
    popularity: number;
    match: number;
    performance: number;
  };
  warnings: string[];
}

export interface PublicSourceStatus {
  source_id: string;
  label: string;
  status: "searched" | "synced" | "degraded" | "auth_required" | "rate_limited" | string;
  message?: string;
  quarantine_review_required?: boolean;
}

export interface PublicPreview {
  ok: boolean;
  prompt_hash: string;
  normalized_prompt: string;
  generated_at: string;
  model: {
    provider: string;
    name: string;
    status: string;
  };
  selection_source?: string;
  placards: RuntimePlacard[];
  source_statuses?: PublicSourceStatus[];
  source_policy: {
    browser_provider_calls: false;
    secrets_included: false;
    allowed_source_hosts: string[];
  };
}

export interface PublicExport {
  files: Record<string, string>;
  manifest: unknown;
}

export interface PublicHealth {
  ok: boolean;
  app: string;
  env: string;
  upstream_configured: boolean;
}
