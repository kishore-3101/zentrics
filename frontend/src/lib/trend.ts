export type TrendDirection = 'up' | 'down' | 'flat';
export type TrendSentiment = 'good' | 'bad' | 'neutral';

export interface Trend {
  direction: TrendDirection;
  label: string;
  sentiment: TrendSentiment;
}

const FLAT_THRESHOLD = 0.05;

function resolveSentiment(direction: TrendDirection, whenUp: TrendSentiment): TrendSentiment {
  if (direction === 'flat' || whenUp === 'neutral') return 'neutral';
  if (direction === 'up') return whenUp;
  return whenUp === 'good' ? 'bad' : 'good';
}

function directionOf(delta: number): TrendDirection {
  if (Math.abs(delta) < FLAT_THRESHOLD) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

const signed = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}${suffix}`;

/** Relative change vs. the previous period, e.g. "+28.6%". */
export function percentTrend(current: number, previous: number, sentimentWhenUp: TrendSentiment): Trend {
  if (previous === 0) return { direction: 'flat', label: 'n/a', sentiment: 'neutral' };
  const delta = ((current - previous) / previous) * 100;
  const direction = directionOf(delta);
  return { direction, label: signed(delta, '%'), sentiment: resolveSentiment(direction, sentimentWhenUp) };
}

/** Absolute change in percentage points, e.g. "+1.8 pts". */
export function pointsTrend(current: number, previous: number, sentimentWhenUp: TrendSentiment): Trend {
  const delta = current - previous;
  const direction = directionOf(delta);
  return { direction, label: signed(delta, ' pts'), sentiment: resolveSentiment(direction, sentimentWhenUp) };
}
