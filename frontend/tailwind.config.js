/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          soft: 'rgb(var(--color-bg-soft) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          soft: 'rgb(var(--color-border-soft) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          dim: 'rgb(var(--color-ink-dim) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint) / <alpha-value>)',
        },
        // Brand / status accents — grounded in plant + soil, not generic SaaS purple
        moss: {
          DEFAULT: 'rgb(var(--color-moss) / <alpha-value>)',
          bright: 'rgb(var(--color-moss-bright) / <alpha-value>)',
          dim: 'rgb(var(--color-moss-dim) / <alpha-value>)',
          50: '#EAF5EE',
        },
        rust: {
          DEFAULT: 'rgb(var(--color-rust) / <alpha-value>)',
          bright: 'rgb(var(--color-rust-bright) / <alpha-value>)',
          dim: 'rgb(var(--color-rust-dim) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--color-amber) / <alpha-value>)',
          bright: 'rgb(var(--color-amber-bright) / <alpha-value>)',
          dim: 'rgb(var(--color-amber-dim) / <alpha-value>)',
        },
        crimson: {
          DEFAULT: 'rgb(var(--color-crimson) / <alpha-value>)',
          bright: 'rgb(var(--color-crimson-bright) / <alpha-value>)',
          dim: 'rgb(var(--color-crimson-dim) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 28px -16px rgba(0,0,0,0.55)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(180deg, rgba(95,168,119,0.08) 0%, rgba(95,168,119,0) 60%)',
      },
    },
  },
  plugins: [],
}
