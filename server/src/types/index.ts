export interface AnalyzeRequest {
  transcript: string;
  metrics: {
    avgWpm?: number;
    avgTempoIndex: number;
    pauseCount: number;
    avgPauseMs: number;
    avgDb: number;
  };
  events: Array<{ type: string; t: number; value?: number; meta?: string }>;
}

export interface AnalyzeResponse {
  summary: string;
  fillerStats: Record<string, number>;
  trainingPlan: string[];
}

export interface LLMProvider {
  analyze(input: AnalyzeRequest): Promise<AnalyzeResponse>;
}
