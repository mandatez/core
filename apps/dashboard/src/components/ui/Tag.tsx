import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type TagVariant =
  | 'default'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral';

const variantClasses: Record<TagVariant, string> = {
  default:
    'bg-bg-overlay text-text-secondary border border-border-default',
  success:
    'bg-accent-success-subtle/40 text-accent-success border border-accent-success/30',
  danger:
    'bg-accent-danger-subtle/40 text-accent-danger border border-accent-danger/30',
  warning:
    'bg-accent-warning/10 text-accent-warning border border-accent-warning/30',
  info: 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30',
  neutral: 'bg-bg-subtle text-text-muted border border-border-subtle',
};

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
}

export const Tag = forwardRef<HTMLSpanElement, TagProps>(
  ({ variant = 'default', className, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded',
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  ),
);
Tag.displayName = 'Tag';
