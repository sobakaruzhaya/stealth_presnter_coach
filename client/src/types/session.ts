export type SessionEventType =
  | 'pause_start'
  | 'pause_end'
  | 'quiet'
  | 'loud'
  | 'fast'
  | 'slow'
  | 'long_pause'
  | 'no_pause_too_long'
  | 'repeat_thesis'
  | 'filler';

export interface SessionEvent {
  type: SessionEventType;
  t: number;
  value?: number;
  meta?: string;
}

export interface LiveMetrics {
  rms: number;
  db: number;
  isSilent: boolean;
  tempoIndex: number;
  currentSilenceMs: number;
}

export interface AudioStats {
  avgRms: number;
  avgDb: number;
  pauseCount: number;
  avgPauseMs: number;
  noPauseForSec: number;
}

export interface VolumeThresholds {
  baselineRms: number;
  quietRms: number;
  loudRms: number;
}

export type Severity = 'info' | 'warn' | 'danger';

export interface CoachHint {
  code:
    | 'FAST'
    | 'SLOW'
    | 'LONG_PAUSE'
    | 'NO_PAUSE_TOO_LONG'
    | 'QUIET'
    | 'LOUD'
    | 'FILLERS'
    | 'REPEAT_THESIS';
  message: string;
  severity: Severity;
}

export interface AnalysisResponse {
  summary: string;
  fillerStats: Record<string, number>;
  trainingPlan: string[];
}

export interface SessionReport {
  createdAt: string;
  durationSec: number;
  transcript: string;
  metrics: {
    avgWpm?: number;
    avgTempoIndex: number;
    pauseCount: number;
    avgPauseMs: number;
    avgDb: number;
    fillerCounts: Record<string, number>;
  };
  events: SessionEvent[];
  analysis: AnalysisResponse;
}
