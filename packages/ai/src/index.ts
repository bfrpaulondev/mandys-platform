export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiRequest {
  system?: string;
  prompt: string;
  metadata?: Record<string, string>;
}

export interface AiResponse {
  text: string;
  model: string;
  usage?: AiUsage;
}

export interface AiProvider {
  readonly key: string;
  generate(request: AiRequest): Promise<AiResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured for this tenant");
    this.name = "AiNotConfiguredError";
  }
}
