import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1020',
        panel: '#11182d',
        accent: '#f4b942',
        accent2: '#60a5fa',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(244,185,66,0.15), 0 20px 60px rgba(0,0,0,0.35)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
