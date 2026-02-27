import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { MetricsPanel } from './components/MetricsPanel';
import { ReportView } from './components/ReportView';
import { TeleprompterView } from './components/TeleprompterView';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { generateCoachHints } from './lib/coachEngine';
import type { AnalysisResponse, SessionEvent, SessionReport } from './types/session';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function fallbackAnalysis(transcript: string, fillerCounts: Record<string, number>): AnalysisResponse {
  const hasTranscript = transcript.trim().length > 0;
  return {
    summary: hasTranscript
      ? 'Your speech is clear overall. Keep a stable pace, add intentional pauses, and reduce filler words.'
      : 'Transcription is unavailable. Focus on volume control, pauses, and steady pacing.',
    fillerStats: fillerCounts,
    trainingPlan: [
      'Day 1: 2 minutes of speaking with a pause every 2-3 sentences.',
      'Day 2: Read aloud for 5 minutes at a consistent volume.',
      'Day 3: Give a 3-minute talk with no filler words.',
      'Day 4: Record two short pitches and compare pacing.',
      'Day 5: Emphasis practice: one key point per paragraph.',
      'Day 6: Full presentation run with timer and pauses.',
      'Day 7: Final run and self-review with a checklist.'
    ]
  };
}

function SessionScreen({ onReportReady }: { onReportReady: (report: SessionReport) => void }) {
  const navigate = useNavigate();
  const audio = useAudioAnalyzer();
  const speech = useSpeechRecognition();

  const [elapsedSec, setElapsedSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [coachEvents, setCoachEvents] = useState<SessionEvent[]>([]);
  const [lastThesisPromptSec, setLastThesisPromptSec] = useState(0);

  const tempoSumRef = useRef(0);
  const tempoSamplesRef = useRef(0);
  const lastHintCodeRef = useRef<string>('');
  const lastHintEmitMsRef = useRef(0);

  useEffect(() => {
    let timer: number | undefined;
    if (running) {
      timer = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [running]);

  useEffect(() => {
    if (!running) {
      return;
    }
    const sampler = window.setInterval(() => {
      tempoSumRef.current += audio.live.tempoIndex;
      tempoSamplesRef.current += 1;
    }, 500);
    return () => window.clearInterval(sampler);
  }, [running, audio.live.tempoIndex]);

  const currentWpm = useMemo(() => {
    if (!speech.supported || elapsedSec === 0 || speech.wordCount === 0) {
      return null;
    }
    return speech.wordCount / (elapsedSec / 60);
  }, [speech.supported, speech.wordCount, elapsedSec]);

  const hints = useMemo(() => {
    return generateCoachHints({
      elapsedSec,
      currentWpm,
      userTargetWpm: 130,
      deltaWpm: 20,
      tempoIndex: audio.live.tempoIndex,
      currentSilenceMs: audio.live.currentSilenceMs,
      noPauseForSec: audio.stats.noPauseForSec,
      rms: audio.live.rms,
      quietRms: audio.thresholds.quietRms,
      loudRms: audio.thresholds.loudRms,
      fillerCounts: speech.fillerCounts,
      lastThesisPromptSec
    });
  }, [
    elapsedSec,
    currentWpm,
    audio.live.tempoIndex,
    audio.live.currentSilenceMs,
    audio.live.rms,
    audio.stats.noPauseForSec,
    audio.thresholds.quietRms,
    audio.thresholds.loudRms,
    speech.fillerCounts,
    lastThesisPromptSec
  ]);

  useEffect(() => {
    if (hints.some((h) => h.code === 'REPEAT_THESIS')) {
      setLastThesisPromptSec(elapsedSec);
    }
  }, [hints, elapsedSec]);

  useEffect(() => {
    if (!running || hints.length === 0) {
      return;
    }

    const top = hints[0];
    const now = performance.now();
    if (top.code !== lastHintCodeRef.current || now - lastHintEmitMsRef.current > 3500) {
      setCoachEvents((prev) => [
        ...prev,
        {
          type:
            top.code === 'FAST'
              ? 'fast'
              : top.code === 'SLOW'
                ? 'slow'
                : top.code === 'LONG_PAUSE'
                  ? 'long_pause'
                  : top.code === 'NO_PAUSE_TOO_LONG'
                    ? 'no_pause_too_long'
                    : top.code === 'REPEAT_THESIS'
                      ? 'repeat_thesis'
                      : top.code === 'FILLERS'
                        ? 'filler'
                        : top.code === 'QUIET'
                          ? 'quiet'
                          : 'loud',
          t: elapsedSec * 1000,
          meta: top.message
        }
      ]);
      lastHintCodeRef.current = top.code;
      lastHintEmitMsRef.current = now;
    }
  }, [hints, running, elapsedSec]);

  const transcriptPreview = useMemo(() => {
    const text = speech.finalTranscript;
    if (text.length < 280) {
      return text || 'Transcript will appear here...';
    }
    return `...${text.slice(-280)}`;
  }, [speech.finalTranscript]);

  const handleStart = async () => {
    if (!running && elapsedSec === 0) {
      setCoachEvents([]);
      tempoSumRef.current = 0;
      tempoSamplesRef.current = 0;
      lastHintCodeRef.current = '';
      lastHintEmitMsRef.current = 0;
      speech.reset();
    }

    await audio.start();
    if (speech.supported) {
      speech.start();
    }
    setRunning(true);
  };

  const handlePause = () => {
    audio.pause();
    if (speech.supported) {
      speech.stop();
    }
    setRunning(false);
  };

  const handleResume = () => {
    audio.resume();
    if (speech.supported) {
      speech.start();
    }
    setRunning(true);
  };

  const handleStop = async () => {
    setLoadingReport(true);
    setRunning(false);

    audio.stop();
    speech.stop();

    const mergedEvents = [...audio.events, ...coachEvents].sort((a, b) => a.t - b.t);
    const avgTempo = tempoSamplesRef.current > 0 ? tempoSumRef.current / tempoSamplesRef.current : audio.live.tempoIndex;

    const payload = {
      transcript: speech.finalTranscript,
      metrics: {
        avgWpm: currentWpm ?? undefined,
        avgTempoIndex: avgTempo,
        pauseCount: audio.stats.pauseCount,
        avgPauseMs: audio.stats.avgPauseMs,
        avgDb: audio.stats.avgDb
      },
      events: mergedEvents
    };

    let analysis: AnalysisResponse;
    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Analyze endpoint returned non-200 status');
      }
      analysis = (await response.json()) as AnalysisResponse;
    } catch {
      analysis = fallbackAnalysis(speech.finalTranscript, speech.fillerCounts);
    }

    const report: SessionReport = {
      createdAt: new Date().toISOString(),
      durationSec: elapsedSec,
      transcript: speech.finalTranscript,
      metrics: {
        avgWpm: currentWpm ?? undefined,
        avgTempoIndex: avgTempo,
        pauseCount: audio.stats.pauseCount,
        avgPauseMs: audio.stats.avgPauseMs,
        avgDb: audio.stats.avgDb,
        fillerCounts: speech.fillerCounts
      },
      events: mergedEvents,
      analysis
    };

    onReportReady(report);

    const historyRaw = localStorage.getItem('spc_recent_reports');
    const history = historyRaw ? (JSON.parse(historyRaw) as SessionReport[]) : [];
    const nextHistory = [report, ...history].slice(0, 5);
    localStorage.setItem('spc_recent_reports', JSON.stringify(nextHistory));

    setLoadingReport(false);
    setElapsedSec(0);
    navigate('/report');
  };

  const handleCalibrate = async () => {
    setCalibrating(true);
    await audio.calibrate();
    setCalibrating(false);
  };

  return (
    <main className="session-layout">
      <div className="main-column">
        <h1>Stealth Presenter Coach</h1>
        {!speech.supported && <p className="warning-banner">SpeechRecognition is unavailable. Running in audio-metrics mode.</p>}
        {audio.error && <p className="warning-banner">{audio.error}</p>}
        {speech.error && <p className="warning-banner">{speech.error}</p>}

        <TeleprompterView
          elapsedSec={elapsedSec}
          hints={hints}
          transcriptPreview={transcriptPreview}
          interimTranscript={speech.interimTranscript}
          micStatus={audio.status}
          speechStatus={speech.supported ? speech.status : 'disabled'}
          canStart={audio.status === 'idle' || audio.status === 'error'}
          canPause={audio.status === 'running'}
          canResume={audio.status === 'paused'}
          canStop={audio.status === 'running' || audio.status === 'paused'}
          loadingReport={loadingReport}
          calibrating={calibrating}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onCalibrate={handleCalibrate}
        />
      </div>

      <MetricsPanel
        currentWpm={currentWpm}
        tempoIndex={audio.live.tempoIndex}
        pauseCount={audio.stats.pauseCount}
        avgPauseMs={audio.stats.avgPauseMs}
        db={audio.live.db}
        rms={audio.live.rms}
        fillerCounts={speech.fillerCounts}
        speechSupported={speech.supported}
      />
    </main>
  );
}

export default function App() {
  const [report, setReport] = useState<SessionReport | null>(null);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/session" replace />} />
      <Route path="/session" element={<SessionScreen onReportReady={setReport} />} />
      <Route path="/report" element={<ReportView report={report} />} />
    </Routes>
  );
}
