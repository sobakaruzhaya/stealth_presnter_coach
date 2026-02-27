import { useCallback, useMemo, useRef, useState } from 'react';

const FILLERS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so', 'i mean'];

type RecognitionStatus = 'idle' | 'running' | 'error';

interface SpeechState {
  supported: boolean;
  disabled: boolean;
  status: RecognitionStatus;
  error: string | null;
  interimTranscript: string;
  finalTranscript: string;
  wordCount: number;
  fillerCounts: Record<string, number>;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): SpeechState {
  const SpeechCtor = (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
    || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

  const supported = Boolean(SpeechCtor);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRunRef = useRef(false);

  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [fillerCounts, setFillerCounts] = useState<Record<string, number>>({});

  const refreshDerivedMetrics = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);

    const normalized = text.toLowerCase();
    const counts: Record<string, number> = {};
    for (const filler of FILLERS) {
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = normalized.match(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'));
      if (matches?.length) {
        counts[filler] = matches.length;
      }
    }
    setFillerCounts(counts);
  }, []);

  const ensureRecognizer = useCallback(() => {
    if (!supported || recognitionRef.current) {
      return;
    }

    const recognition = new SpeechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newInterim = '';
      let newFinalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinalChunk += `${transcript} `;
        } else {
          newInterim += transcript;
        }
      }

      setInterimTranscript(newInterim);
      if (newFinalChunk) {
        setFinalTranscript((prev) => {
          const updated = `${prev} ${newFinalChunk}`.trim();
          refreshDerivedMetrics(updated);
          return updated;
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setStatus('error');
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          setStatus('idle');
        }
      }
    };

    recognitionRef.current = recognition;
  }, [SpeechCtor, refreshDerivedMetrics, status, supported]);

  const start = useCallback(() => {
    if (!supported) {
      return;
    }
    ensureRecognizer();
    setError(null);
    shouldRunRef.current = true;
    try {
      recognitionRef.current?.start();
      setStatus('running');
    } catch {
      // API can throw if started twice; ignore for MVP.
    }
  }, [ensureRecognizer, supported]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    setInterimTranscript('');
    setFinalTranscript('');
    setWordCount(0);
    setFillerCounts({});
    setError(null);
    setStatus('idle');
    shouldRunRef.current = false;
  }, []);

  return useMemo(
    () => ({
      supported,
      disabled: !supported,
      status,
      error,
      interimTranscript,
      finalTranscript,
      wordCount,
      fillerCounts,
      start,
      stop,
      reset
    }),
    [supported, status, error, interimTranscript, finalTranscript, wordCount, fillerCounts, start, stop, reset]
  );
}
