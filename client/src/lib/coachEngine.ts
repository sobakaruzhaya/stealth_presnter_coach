import type { CoachHint } from '../types/session';

export interface CoachInput {
  elapsedSec: number;
  currentWpm: number | null;
  userTargetWpm: number;
  deltaWpm: number;
  tempoIndex: number;
  currentSilenceMs: number;
  noPauseForSec: number;
  rms: number;
  quietRms: number;
  loudRms: number;
  fillerCounts: Record<string, number>;
  lastThesisPromptSec: number;
}

export function generateCoachHints(input: CoachInput): CoachHint[] {
  const hints: CoachHint[] = [];

  if (input.currentWpm !== null && input.elapsedSec > 10) {
    if (input.currentWpm > input.userTargetWpm + input.deltaWpm) {
      hints.push({ code: 'FAST', message: 'Too fast. Slow down.', severity: 'danger' });
    } else if (input.currentWpm < input.userTargetWpm - input.deltaWpm) {
      hints.push({ code: 'SLOW', message: 'Too slow. Add more energy.', severity: 'warn' });
    }
  } else {
    if (input.tempoIndex > 180) {
      hints.push({ code: 'FAST', message: 'Tempo is high. Ease off a bit.', severity: 'warn' });
    }
    if (input.tempoIndex > 0 && input.tempoIndex < 70 && input.elapsedSec > 12) {
      hints.push({ code: 'SLOW', message: 'Tempo is low. Speed up slightly.', severity: 'info' });
    }
  }

  if (input.currentSilenceMs > 1500) {
    hints.push({ code: 'LONG_PAUSE', message: 'Pause is too long. Continue your thought.', severity: 'danger' });
  }

  if (input.noPauseForSec > 25 && input.currentSilenceMs < 200) {
    hints.push({ code: 'NO_PAUSE_TOO_LONG', message: 'Add a short pause for emphasis.', severity: 'warn' });
  }

  if (input.rms < input.quietRms) {
    hints.push({ code: 'QUIET', message: 'Speak louder.', severity: 'warn' });
  }

  if (input.rms > input.loudRms) {
    hints.push({ code: 'LOUD', message: 'Too loud. Lower your voice a bit.', severity: 'warn' });
  }

  const topFiller = Object.entries(input.fillerCounts).sort((a, b) => b[1] - a[1])[0];
  if (topFiller && topFiller[1] >= 2) {
    hints.push({ code: 'FILLERS', message: `Reduce filler: "${topFiller[0]}"`, severity: 'warn' });
  }

  if (input.elapsedSec - input.lastThesisPromptSec > 75) {
    hints.push({ code: 'REPEAT_THESIS', message: 'Repeat your main thesis.', severity: 'info' });
  }

  const priority: Record<CoachHint['severity'], number> = { danger: 3, warn: 2, info: 1 };
  return hints.sort((a, b) => priority[b.severity] - priority[a.severity]).slice(0, 3);
}
