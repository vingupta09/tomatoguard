/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — deep pine-black, not pure neutral black
        bg: { DEFAULT: '#0C1310', soft: '#0F1713' },
        surface: { DEFAULT: '#151F1A', raised: '#1B2620', hover: '#213026' },
        border: { DEFAULT: '#263731', soft: '#1C2A24' },
        // Text
        ink: { DEFAULT: '#EAF0EA', dim: '#9DAEA3', faint: '#6C7C72' },
        // Brand / status accents — grounded in plant + soil, not generic SaaS purple
        moss: { DEFAULT: '#5FA877', bright: '#7FC496', dim: '#3C6E4E', 50: '#EAF5EE' },
        rust: { DEFAULT: '#C15A34', bright: '#DB7A52', dim: '#7A3A21' },
        amber: { DEFAULT: '#CC9640', bright: '#E3B466', dim: '#7A5A26' },
        crimson: { DEFAULT: '#B3423A', bright: '#D25F56', dim: '#6E2A25' },
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
