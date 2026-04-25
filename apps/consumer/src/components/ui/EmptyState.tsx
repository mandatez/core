import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional leading icon. Pass a lucide-react icon or any ReactNode. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional CTA. Typically a <Button />. */
  action?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-16',
        'rounded-lg border border-dashed border-border-default bg-bg-subtle/40',
        className,
      )}
      {...rest}
    >
      {icon ? (
        <div className="mb-4 text-text-muted" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight text-text-primary">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  ),
);

EmptyState.displayName = 'EmptyState';
