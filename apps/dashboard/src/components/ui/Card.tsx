import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardVariant =
  | 'default'
  | 'elevated'
  | 'outlined'
  | 'success-tinted'
  | 'danger-tinted';

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-bg-elevated border border-border-default rounded-lg',
  elevated:
    'bg-bg-elevated border border-border-default shadow-sm rounded-lg',
  outlined: 'bg-transparent border border-border-default rounded-lg',
  'success-tinted':
    'bg-accent-success-subtle/30 border-l-2 border-accent-success rounded-r-lg',
  'danger-tinted':
    'bg-accent-danger-subtle/30 border-l-2 border-accent-danger rounded-r-lg',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(variantClasses[variant], className)}
      {...rest}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 p-6', className)}
    {...rest}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...rest }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold tracking-tight text-text-primary',
      className,
    )}
    {...rest}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...rest }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-sm text-text-secondary leading-relaxed',
      className,
    )}
    {...rest}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div ref={ref} className={cn('px-6 pb-6', className)} {...rest} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-3 px-6 pb-6', className)}
    {...rest}
  />
));
CardFooter.displayName = 'CardFooter';
