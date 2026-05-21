export interface PublicSourceLink {
  label: string;
  url: string;
  source_kind: string;
}

export interface PublicArtifactLicense {
  name: string;
  url?: string | null;
  source: string;
  confidence: "high" | "medium" | "low" | string;
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
  license: PublicArtifactLicense;
  score_breakdown: Record<string, number>;
  why_selected: string;
  setup_hint: string;
  credential_status: "not_required" | "optional" | "missing" | "configured" | string;
  warnings: string[];
}

export interface RuntimePlacard {
  platform: "codex" | "claude_code" | "openclaw";
  label: string;
  model: string;
  status: string;
  accent: string;
  file_tree: string[];
  main_files: Record<string, string>;
  skills: PublicArtifact[];
  mcps: PublicArtifact[];
  tools: PublicArtifact[];
  bundle_sections?: Array<{
    section_id: string;
    title: string;
    artifact_refs: string[];
  }>;
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
  agent_domain?: string;
  agent_archetype?: string;
  intent_confidence?: number;
  model_trace_summary?: {
    detected_domain?: string;
    detected_archetype?: string;
    selection_source?: string;
    catalog_candidates_used?: boolean;
    source_queries?: string[];
    reranker_status?: string;
    reranker_reason?: string;
    summary?: string;
  };
  fallback_reason?: string;
  placards: RuntimePlacard[];
  source_statuses?: PublicSourceStatus[];
  calibration?: {
    teacher?: {
      provider: string;
      model: string;
      role: string;
    };
    students?: Array<{
      provider: string;
      model: string;
      role: string;
      public_eligible: boolean;
      promotion_gate?: Record<string, number>;
    }>;
    latest_eval?: unknown;
    public_serving_policy?: string;
  };
  source_policy: {
    browser_provider_calls: false;
    secrets_included: false;
    allowed_source_hosts: string[];
  };
}
