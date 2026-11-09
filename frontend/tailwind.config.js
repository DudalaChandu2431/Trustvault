/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          900: '#121212', // Charcoal dark
          800: '#1a1a1e', // Charcoal medium
          700: '#27272a', // Charcoal light
          600: '#3f3f46',
          sand: '#f4f4f5', // Sand / Cream
          accent: '#0052FF', // Electric Blue button pop
          cyan: '#06B6D4',
          indigo: '#6366F1'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
