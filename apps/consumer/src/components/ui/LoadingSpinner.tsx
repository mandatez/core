import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export interface LoadingSpinnerProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  size?: SpinnerSize;
}

export const LoadingSpinner = forwardRef<HTMLSpanElement, LoadingSpinnerProps>(
  ({ size = 'md', className, ...rest }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn('inline-flex items-center justify-center', className)}
      {...rest}
    >
      <svg
        className={cn('animate-spin', sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
        />
      </svg>
    </span>
  ),
);

LoadingSpinner.displayName = 'LoadingSpinner';
