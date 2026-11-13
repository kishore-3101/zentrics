type ClassValue = string | false | null | undefined;

/** Minimal class joiner. Avoid passing conflicting Tailwind utilities (no tailwind-merge). */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
