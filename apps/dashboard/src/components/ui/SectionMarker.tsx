import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface SectionMarkerProps extends HTMLAttributes<HTMLDivElement> {
  number: string;
  label: string;
}

export const SectionMarker = forwardRef<HTMLDivElement, SectionMarkerProps>(
  ({ number, label, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-3', className)}
      {...rest}
    >
      <span className="font-mono text-xs uppercase tracking-widest text-accent-primary">
        / {number}
      </span>
      <hr className="h-px w-10 border-0 border-t border-border-default" />
      <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
        {label}
      </span>
    </div>
  ),
);

SectionMarker.displayName = 'SectionMarker';
