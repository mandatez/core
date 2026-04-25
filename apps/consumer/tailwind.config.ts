import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 reads design tokens from the `@theme` block in
 * `src/app/globals.css` — that file is the source of truth.
 *
 * This config mirrors those tokens for any tooling (IDE intellisense,
 * v3-style scanners) that still reads tailwind.config.ts directly.
 * Keep the two in sync.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a0a',
          elevated: '#111113',
          subtle: '#18181b',
          overlay: '#1f1f23',
        },
        border: {
          default: '#27272a',
          subtle: '#1f1f23',
          strong: '#3f3f46',
          focus: '#3b82f6',
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
          disabled: '#52525b',
        },
        accent: {
          primary: '#3b82f6',
          'primary-hover': '#60a5fa',
          'primary-pressed': '#2563eb',
          success: '#10b981',
          'success-subtle': '#064e3b',
          danger: '#ef4444',
          'danger-subtle': '#450a0a',
          warning: '#f59e0b',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      fontFamily: {
        display: ['var(--font-geist)', 'Geist', 'system-ui', 'sans-serif'],
        sans: ['var(--font-geist)', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Geist Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
