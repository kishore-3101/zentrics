import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EASE_OUT } from '../../lib/motion';
import { cn } from '../../lib/cn';

interface PopoverContext {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

interface PopoverProps {
  /** Renders the element that opens the popover. Wire `toggle` and `open` yourself. */
  trigger: (ctx: PopoverContext) => ReactNode;
  children: ReactNode | ((ctx: PopoverContext) => ReactNode);
  align?: 'start' | 'end';
  panelLabel?: string;
  className?: string;
  panelClassName?: string;
}

/** Small animated dropdown with outside-click and Escape dismissal. */
export function Popover({
  trigger,
  children,
  align = 'end',
  panelLabel,
  className,
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const ctx: PopoverContext = { open, toggle, close };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger(ctx)}
      <AnimatePresence>
        {open && (
          <motion.div
            aria-label={panelLabel}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className={cn(
              'absolute top-full z-40 mt-2 max-w-[calc(100vw-1.5rem)] rounded-xl border border-gold/20 bg-sidebar/95 shadow-panel backdrop-blur-md',
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
              panelClassName,
            )}
          >
            {typeof children === 'function' ? children(ctx) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
