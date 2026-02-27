import type { AnalyzeRequest, AnalyzeResponse, LLMProvider } from '../types';

const FILLERS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so', 'i mean'];

function extractFillers(transcript: string): Record<string, number> {
  const normalized = transcript.toLowerCase();
  const counts: Record<string, number> = {};

  for (const filler of FILLERS) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = normalized.match(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'));
    if (matches?.length) {
      counts[filler] = matches.length;
    }
  }

  return counts;
}

export class MockProvider implements LLMProvider {
  async analyze(input: AnalyzeRequest): Promise<AnalyzeResponse> {
    const fillerStats = extractFillers(input.transcript);
    const parts: string[] = [];

    if (input.transcript.trim().length === 0) {
      parts.push('Transcription is unavailable, so analysis is based on audio metrics.');
    } else {
      parts.push('Your speech structure is understandable, but the final thesis statement could be more explicit.');
    }

    if (typeof input.metrics.avgWpm === 'number') {
      if (input.metrics.avgWpm > 155) {
        parts.push('Your pace is above a comfortable range, so key points may be lost.');
      } else if (input.metrics.avgWpm < 105) {
        parts.push('Your pace is slow; adding rhythm in transitions would help.');
      } else {
        parts.push('Your speaking pace is in a healthy range.');
      }
    } else {
      if (input.metrics.avgTempoIndex > 170) {
        parts.push('Audio heuristics suggest your pace is occasionally too sharp.');
      } else {
        parts.push('Audio heuristics suggest your pace is mostly steady.');
      }
    }

    if (input.metrics.pauseCount < 2) {
      parts.push('Very few pauses were used; add short pauses before key blocks.');
    } else {
      parts.push('Pauses are present; keep using them as semantic emphasis.');
    }

    if (Object.keys(fillerStats).length > 0) {
      parts.push('Repeated filler words were detected; use a short pause instead.');
    }

    const trainingPlan = [
      'Day 1: 3 runs of 90 seconds, with a pause after each thesis.',
      'Day 2: 10 minutes of diction work: slow reading with clear endings.',
      'Day 3: 2-minute pitch with no filler words, recorded on your phone.',
      'Day 4: Pace control: one fast block, one slow block, then a balanced pass.',
      'Day 5: Volume control: 5 minutes at a stable speaking level.',
      'Day 6: Full presentation rehearsal with timing and pause markers.',
      'Day 7: Final rehearsal with a short self-review of 3 strengths and 3 weaknesses.'
    ];

    return {
      summary: parts.join(' '),
      fillerStats,
      trainingPlan
    };
  }
}
