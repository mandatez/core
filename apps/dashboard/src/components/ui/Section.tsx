import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Use the tighter --section-padding-y-tight rhythm (clamped 48-96px). */
  tight?: boolean;
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ tight = false, className, style, ...rest }, ref) => (
    <section
      ref={ref}
      className={cn('relative', className)}
      style={{
        paddingTop: tight
          ? 'var(--section-padding-y-tight)'
          : 'var(--section-padding-y)',
        paddingBottom: tight
          ? 'var(--section-padding-y-tight)'
          : 'var(--section-padding-y)',
        ...style,
      }}
      {...rest}
    />
  ),
);

Section.displayName = 'Section';
