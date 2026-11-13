/** Formats elapsed virtual seconds as `T+HH:MM:SS`. */
export function formatVirtualTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `T+${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const formatCount = (value: number): string => {
  return new Intl.NumberFormat('en-IN').format(value);
};

export const formatInrCompact = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

export const formatPercent = (
  value: number,
  fractionDigits: number = 1
): string => {
  return `${value.toFixed(fractionDigits)}%`;
};

export const formatRelativeTime = (
  value: string | number | Date
): string => {
  const date = new Date(value);
  const diffSeconds = Math.round(
    (date.getTime() - Date.now()) / 1000
  );

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
  });

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
      return formatter.format(
        Math.round(diffSeconds / seconds),
        unit
      );
    }
  }

  return 'Just now';
};
