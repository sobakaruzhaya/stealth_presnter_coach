import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioStats, LiveMetrics, SessionEvent, VolumeThresholds } from '../types/session';

const DEFAULT_THRESHOLDS: VolumeThresholds = {
  baselineRms: 0.03,
  quietRms: 0.02,
  loudRms: 0.08
};

const MIN_PAUSE_MS = 350;

type AnalyzerStatus = 'idle' | 'running' | 'paused' | 'error';

interface AudioAnalyzerResult {
  status: AnalyzerStatus;
  error: string | null;
  live: LiveMetrics;
  stats: AudioStats;
  events: SessionEvent[];
  thresholds: VolumeThresholds;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  calibrate: () => Promise<void>;
}

export function useAudioAnalyzer(): AudioAnalyzerResult {
  const [status, setStatus] = useState<AnalyzerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveMetrics>({
    rms: 0,
    db: -100,
    isSilent: true,
    tempoIndex: 0,
    currentSilenceMs: 0
  });
  const [stats, setStats] = useState<AudioStats>({
    avgRms: 0,
    avgDb: -100,
    pauseCount: 0,
    avgPauseMs: 0,
    noPauseForSec: 0
  });
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [thresholds, setThresholds] = useState<VolumeThresholds>(DEFAULT_THRESHOLDS);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const sampleCountRef = useRef(0);
  const totalRmsRef = useRef(0);
  const totalDbRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  const totalPauseMsRef = useRef(0);
  const pauseCountRef = useRef(0);
  const lastPauseEndRef = useRef(0);

  const lastRmsRef = useRef(0);
  const peakTimesRef = useRef<number[]>([]);
  const lastPeakAtRef = useRef(0);
  const volumeZoneRef = useRef<'quiet' | 'normal' | 'loud'>('normal');

  const emitEvent = useCallback((event: SessionEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const releaseResources = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    sourceRef.current = null;
    analyserRef.current = null;
  }, []);

  const runLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || status !== 'running') {
      return;
    }

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      sumSquares += buffer[i] * buffer[i];
    }

    const rms = Math.sqrt(sumSquares / buffer.length);
    const db = 20 * Math.log10(rms + 1e-8);
    const now = performance.now();
    const relativeT = now - startTimeRef.current;
    const isSilent = rms < thresholds.quietRms;

    sampleCountRef.current += 1;
    totalRmsRef.current += rms;
    totalDbRef.current += db;

    if (rms > Math.max(thresholds.baselineRms * 1.25, 0.015) && lastRmsRef.current <= Math.max(thresholds.baselineRms * 1.25, 0.015)) {
      if (now - lastPeakAtRef.current > 120) {
        peakTimesRef.current.push(relativeT);
        lastPeakAtRef.current = now;
      }
    }

    const peakWindowStart = relativeT - 20000;
    peakTimesRef.current = peakTimesRef.current.filter((t) => t >= peakWindowStart);
    const tempoIndex = peakTimesRef.current.length * 3;

    if (isSilent && pauseStartRef.current === null) {
      pauseStartRef.current = now;
      emitEvent({ type: 'pause_start', t: relativeT });
    }

    if (!isSilent && pauseStartRef.current !== null) {
      const pauseMs = now - pauseStartRef.current;
      if (pauseMs >= MIN_PAUSE_MS) {
        pauseCountRef.current += 1;
        totalPauseMsRef.current += pauseMs;
        lastPauseEndRef.current = now;
      }
      emitEvent({ type: 'pause_end', t: relativeT, value: pauseMs });
      pauseStartRef.current = null;
    }

    const zone: 'quiet' | 'normal' | 'loud' = rms < thresholds.quietRms ? 'quiet' : rms > thresholds.loudRms ? 'loud' : 'normal';
    if (zone !== volumeZoneRef.current) {
      if (zone === 'quiet') {
        emitEvent({ type: 'quiet', t: relativeT, value: rms });
      }
      if (zone === 'loud') {
        emitEvent({ type: 'loud', t: relativeT, value: rms });
      }
      volumeZoneRef.current = zone;
    }

    const currentSilenceMs = isSilent && pauseStartRef.current !== null ? now - pauseStartRef.current : 0;
    const avgRms = totalRmsRef.current / sampleCountRef.current;
    const avgDb = totalDbRef.current / sampleCountRef.current;
    const avgPauseMs = pauseCountRef.current > 0 ? totalPauseMsRef.current / pauseCountRef.current : 0;
    const noPauseForSec = lastPauseEndRef.current > 0 ? (now - lastPauseEndRef.current) / 1000 : relativeT / 1000;

    setLive({ rms, db, isSilent, tempoIndex, currentSilenceMs });
    setStats({
      avgRms,
      avgDb,
      pauseCount: pauseCountRef.current,
      avgPauseMs,
      noPauseForSec
    });

    lastRmsRef.current = rms;
    rafRef.current = requestAnimationFrame(runLoop);
  }, [emitEvent, status, thresholds]);

  useEffect(() => {
    if (status === 'running') {
      rafRef.current = requestAnimationFrame(runLoop);
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [status, runLoop]);

  useEffect(() => {
    return () => releaseResources();
  }, [releaseResources]);

  const start = useCallback(async () => {
    try {
      setError(null);
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;

        source.connect(analyser);

        streamRef.current = stream;
        audioContextRef.current = audioContext;
        sourceRef.current = source;
        analyserRef.current = analyser;

        startTimeRef.current = performance.now();
        lastPauseEndRef.current = startTimeRef.current;
        sampleCountRef.current = 0;
        totalRmsRef.current = 0;
        totalDbRef.current = 0;
        pauseCountRef.current = 0;
        totalPauseMsRef.current = 0;
        peakTimesRef.current = [];
        setEvents([]);
      }

      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setStatus('running');
    } catch (err) {
      setError('Cannot access microphone. Check browser permissions.');
      setStatus('error');
    }
  }, []);

  const pause = useCallback(() => {
    if (status !== 'running') {
      return;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioContextRef.current?.suspend().catch(() => undefined);
    setStatus('paused');
  }, [status]);

  const resume = useCallback(() => {
    if (status !== 'paused') {
      return;
    }
    audioContextRef.current?.resume().catch(() => undefined);
    setStatus('running');
  }, [status]);

  const stop = useCallback(() => {
    releaseResources();
    setStatus('idle');
  }, [releaseResources]);

  const calibrate = useCallback(async () => {
    try {
      setError(null);

      // Calibration samples ambient/speaking baseline for 3s and adapts thresholds.
      let tempStream: MediaStream | null = null;
      let tempContext: AudioContext | null = null;
      let tempAnalyser: AnalyserNode | null = null;

      if (analyserRef.current) {
        tempAnalyser = analyserRef.current;
      } else {
        tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempContext = new AudioContext();
        const tempSource = tempContext.createMediaStreamSource(tempStream);
        tempAnalyser = tempContext.createAnalyser();
        tempAnalyser.fftSize = 1024;
        tempSource.connect(tempAnalyser);
      }

      const startAt = performance.now();
      const values: number[] = [];
      const sampleBuffer = new Float32Array(tempAnalyser.fftSize);

      while (performance.now() - startAt < 3000) {
        tempAnalyser.getFloatTimeDomainData(sampleBuffer);
        let sumSquares = 0;
        for (let i = 0; i < sampleBuffer.length; i += 1) {
          sumSquares += sampleBuffer[i] * sampleBuffer[i];
        }
        values.push(Math.sqrt(sumSquares / sampleBuffer.length));
        await new Promise((resolve) => setTimeout(resolve, 45));
      }

      const baseline = values.reduce((a, b) => a + b, 0) / values.length;
      setThresholds({
        baselineRms: baseline,
        quietRms: Math.max(baseline * 0.65, 0.008),
        loudRms: Math.max(baseline * 2.2, 0.03)
      });

      if (tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }
      if (tempContext) {
        tempContext.close().catch(() => undefined);
      }
    } catch (err) {
      setError('Calibration failed. Try again with microphone enabled.');
    }
  }, []);

  return useMemo(
    () => ({ status, error, live, stats, events, thresholds, start, pause, resume, stop, calibrate }),
    [status, error, live, stats, events, thresholds, start, pause, resume, stop, calibrate]
  );
}
