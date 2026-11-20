/** @type {import('tailwindcss').Config} — same colour names as the React app (bg-brand, text-muted, border-line, bg-wash…). */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ["'Manrope Variable'", "'Segoe UI'", 'system-ui', 'sans-serif'] },
      colors: { brand: '#1d4ed8', ink: '#0f1b3d', muted: '#6b7690', line: '#e3e8f2', wash: '#eef2ff' },
    },
  },
  plugins: [],
};
