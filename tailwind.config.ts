/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        terminal: {
          bg: '#080C10',
          surface: '#0D1117',
          border: '#1A2332',
          green: '#00FF9C',
          cyan: '#00D4FF',
          amber: '#FFB800',
          red: '#FF4560',
          purple: '#BF5AF2',
          muted: '#4A5568',
          text: '#C9D1D9',
          dim: '#8B949E',
        },
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'typing': 'typing 1.5s steps(40) forwards',
        'scan': 'scan 3s linear infinite',
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
        slideUp: { from: { transform: 'translateY(10px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseGlow: { '0%, 100%': { boxShadow: '0 0 5px rgba(0,255,156,0.3)' }, '50%': { boxShadow: '0 0 20px rgba(0,255,156,0.6)' } },
        scan: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,255,156,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,156,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '30px 30px',
      },
    },
  },
  plugins: [],
};
