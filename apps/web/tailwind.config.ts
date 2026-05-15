import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0b',
        surface: '#111114',
        'surface-2': '#16161a',
        'border-subtle': '#26262c',
        'border-accent': '#3a3a44',
        'text-primary': '#f5f5f7',
        'text-secondary': '#a1a1aa',
        'text-muted': '#71717a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      maxWidth: {
        content: '64rem',
      },
    },
  },
  plugins: [],
};

export default config;
