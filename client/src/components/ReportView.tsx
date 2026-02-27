import { Link } from 'react-router-dom';
import type { SessionReport } from '../types/session';

interface ReportViewProps {
  report: SessionReport | null;
}

export function ReportView({ report }: ReportViewProps) {
  if (!report) {
    return (
      <main className="report-empty">
        <p>The report is not ready yet.</p>
        <Link to="/session">Back to session</Link>
      </main>
    );
  }

  return (
    <main className="report-page">
      <header>
        <h1>Session Report</h1>
        <p>{new Date(report.createdAt).toLocaleString()}</p>
      </header>

      <section className="report-grid">
        <article className="report-card">
          <h3>Summary Metrics</h3>
          <p>Duration: {Math.round(report.durationSec)} sec</p>
          <p>Avg WPM: {report.metrics.avgWpm ? Math.round(report.metrics.avgWpm) : 'n/a'}</p>
          <p>Tempo Index: {Math.round(report.metrics.avgTempoIndex)}</p>
          <p>Pauses: {report.metrics.pauseCount}</p>
          <p>Avg Pause: {Math.round(report.metrics.avgPauseMs)} ms</p>
          <p>Avg Volume: {Math.round(report.metrics.avgDb)} dB</p>
        </article>

        <article className="report-card">
          <h3>Filler Stats</h3>
          {Object.keys(report.analysis.fillerStats).length === 0 && <p>No significant filler words detected.</p>}
          {Object.entries(report.analysis.fillerStats).map(([word, count]) => (
            <p key={word}>
              {word}: <strong>{count}</strong>
            </p>
          ))}
        </article>

        <article className="report-card wide">
          <h3>LLM Review (Mock-ready)</h3>
          <p>{report.analysis.summary}</p>
        </article>

        <article className="report-card wide">
          <h3>7-Day Plan</h3>
          <ol>
            {report.analysis.trainingPlan.map((task, index) => (
              <li key={`${index}-${task}`}>{task}</li>
            ))}
          </ol>
        </article>

        <article className="report-card wide">
          <h3>Transcript</h3>
          {report.transcript.trim().length === 0 ? (
            <p>No transcript captured for this session.</p>
          ) : (
            <div className="transcript-report-box">
              <p>{report.transcript}</p>
            </div>
          )}
        </article>

        <article className="report-card wide">
          <h3>Timeline</h3>
          <div className="timeline-list">
            {report.events.length === 0 && <p>No events</p>}
            {report.events.slice(0, 120).map((event, i) => (
              <p key={`${event.type}-${event.t}-${i}`}>
                [{Math.round(event.t / 1000)}s] {event.type}
                {event.meta ? `: ${event.meta}` : ''}
              </p>
            ))}
          </div>
        </article>
      </section>

      <Link to="/session" className="back-link">
        New Session
      </Link>
    </main>
  );
}
