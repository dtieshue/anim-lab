/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neutral: {
          925: '#121215',
        },
        phase: {
          anticipation: '#a78bfa',
          startup: '#60a5fa',
          active: '#f87171',
          impact: '#fbbf24',
          recovery: '#4ade80',
        },
      },
    },
  },
  plugins: [],
};
