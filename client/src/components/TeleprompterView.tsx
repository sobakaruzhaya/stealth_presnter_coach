import type { CoachHint } from '../types/session';

interface TeleprompterViewProps {
  elapsedSec: number;
  hints: CoachHint[];
  transcriptPreview: string;
  interimTranscript: string;
  micStatus: string;
  speechStatus: string;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  loadingReport: boolean;
  calibrating: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCalibrate: () => void;
}

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
}

export function TeleprompterView(props: TeleprompterViewProps) {
  return (
    <section className="teleprompter-card">
      <div className="top-row">
        <div>
          <p className="label">Session Timer</p>
          <p className="timer">{formatTime(props.elapsedSec)}</p>
        </div>
        <div className="statuses">
          <span className="status-pill">Mic: {props.micStatus}</span>
          <span className="status-pill">Speech: {props.speechStatus}</span>
        </div>
      </div>

      <div className="hint-zone">
        {props.hints.length === 0 && <p className="hint-line neutral">Start speaking. Coaching hints will appear here.</p>}
        {props.hints.map((hint) => (
          <p key={hint.code} className={`hint-line ${hint.severity}`}>
            {hint.message}
          </p>
        ))}
      </div>

      <div className="controls">
        <button onClick={props.onStart} disabled={!props.canStart}>
          Start
        </button>
        <button onClick={props.onPause} disabled={!props.canPause}>
          Pause
        </button>
        <button onClick={props.onResume} disabled={!props.canResume}>
          Resume
        </button>
        <button className="danger" onClick={props.onStop} disabled={!props.canStop || props.loadingReport}>
          {props.loadingReport ? 'Generating...' : 'Stop'}
        </button>
        <button className="secondary" onClick={props.onCalibrate} disabled={props.calibrating || props.loadingReport}>
          {props.calibrating ? 'Calibrating...' : 'Calibrate 3s'}
        </button>
      </div>

      <div className="transcript-tape">
        <p className="label">Transcript Tape</p>
        <p className="transcript-text">
          {props.transcriptPreview}
          {props.interimTranscript ? <span className="interim"> {props.interimTranscript}</span> : null}
        </p>
      </div>
    </section>
  );
}
