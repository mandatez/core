'use client';

import { cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from './cn';
import { LoadingSpinner } from './LoadingSpinner';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'success';

export type ButtonSize = 'sm' | 'md' | 'lg';

const baseClasses =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
  'transition-colors duration-150 select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-primary text-white hover:bg-accent-primary-hover active:bg-accent-primary-pressed',
  secondary:
    'bg-transparent border border-border-default text-text-primary hover:bg-bg-elevated hover:border-border-strong',
  ghost:
    'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
  destructive: 'bg-accent-danger text-white hover:bg-red-600',
  success: 'bg-accent-success text-white hover:bg-emerald-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      asChild = false,
      leftIcon,
      rightIcon,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const classes = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className,
    );

    // asChild: clone the single child and merge our classes onto it.
    // Used to wrap a Next/Link or <a> with button styling without a
    // nested <button> element.
    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string }>;
      return cloneElement(child, {
        className: cn(classes, child.props.className),
      });
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <LoadingSpinner size="sm" /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
