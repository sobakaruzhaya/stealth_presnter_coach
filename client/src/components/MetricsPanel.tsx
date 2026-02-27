interface MetricsPanelProps {
  currentWpm: number | null;
  tempoIndex: number;
  pauseCount: number;
  avgPauseMs: number;
  db: number;
  rms: number;
  fillerCounts: Record<string, number>;
  speechSupported: boolean;
}

function barPercentFromDb(db: number): number {
  return Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
}

export function MetricsPanel(props: MetricsPanelProps) {
  const topFillers = Object.entries(props.fillerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <aside className="metrics-card">
      <h3>Live Metrics</h3>
      <div className="metric-item">
        <span>WPM / Tempo</span>
        <strong>{props.currentWpm !== null ? `${Math.round(props.currentWpm)} WPM` : `${Math.round(props.tempoIndex)} idx`}</strong>
      </div>
      <div className="metric-item">
        <span>Pauses</span>
        <strong>
          {props.pauseCount} ({Math.round(props.avgPauseMs)} ms avg)
        </strong>
      </div>
      <div className="metric-item">
        <span>Volume</span>
        <strong>{Math.round(props.db)} dB</strong>
      </div>
      <div className="volume-bar">
        <div className="volume-fill" style={{ width: `${barPercentFromDb(props.db)}%` }} />
      </div>
      <div className="metric-item small">
        <span>RMS</span>
        <strong>{props.rms.toFixed(4)}</strong>
      </div>

      <div className="filler-box">
        <h4>Fillers {props.speechSupported ? '' : '(speech API off)'}</h4>
        {topFillers.length === 0 && <p className="muted">No data yet</p>}
        {topFillers.map(([word, count]) => (
          <p key={word}>
            {word}: <strong>{count}</strong>
          </p>
        ))}
      </div>
    </aside>
  );
}
