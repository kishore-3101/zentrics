import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const VARIANTS = {
  ghost: 'text-muted enabled:hover:bg-white/5 enabled:hover:text-ink',
  outline:
    'border border-gold/20 text-muted enabled:hover:border-gold/45 enabled:hover:bg-gold/5 enabled:hover:text-gold-light',
  emerald:
    'border border-emerald/30 bg-emerald/12 text-emerald enabled:hover:bg-emerald/22 enabled:hover:shadow-glow-emerald',
  gold: 'border border-gold/30 bg-gold/12 text-gold-light enabled:hover:bg-gold/22 enabled:hover:shadow-glow-gold',
} as const;

const SIZES = {
  sm: 'size-8 rounded-lg',
  md: 'size-9 rounded-xl',
} as const;

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** Required accessible name (also shown as the native tooltip). */
  label: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  children: ReactNode;
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  className,
  disabled,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
