import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type NumberDisplaySize = 'sm' | 'md' | 'lg';
export type NumberDisplayAccent =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning';

const sizeClasses: Record<NumberDisplaySize, string> = {
  sm: 'text-5xl',
  md: 'text-7xl',
  lg: 'text-9xl',
};

const accentClasses: Record<NumberDisplayAccent, string> = {
  primary: 'text-accent-primary',
  success: 'text-accent-success',
  danger: 'text-accent-danger',
  warning: 'text-accent-warning',
};

export interface NumberDisplayProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: string | number;
  suffix?: string;
  size?: NumberDisplaySize;
  accent?: NumberDisplayAccent;
}

export const NumberDisplay = forwardRef<HTMLDivElement, NumberDisplayProps>(
  ({ value, suffix, size = 'md', accent, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-baseline gap-2 font-display font-bold leading-none tracking-tight',
        className,
      )}
      {...rest}
    >
      <span className={cn(sizeClasses[size], 'text-text-primary')}>
        {value}
      </span>
      {suffix ? (
        <span
          className={cn(
            'font-mono text-sm uppercase tracking-widest',
            accent ? accentClasses[accent] : 'text-text-muted',
          )}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  ),
);

NumberDisplay.displayName = 'NumberDisplay';
