/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cortex-purple': {
          100: '#F6EBFF',
          200: '#E2C7FF',
          300: '#CDA3FF',
          400: '#B880FF',
          500: '#A35CFF',
          600: '#8F38FF',
          700: '#7B14FF',
          800: '#6600F0',
          900: '#5200BE',
        },
        'neon-purple': '#A35CFF',
        'dark-bg': '#121212',
        'dark-card': '#1E1E1E',
        'dark-border': '#333333',
      },
      boxShadow: {
        'neon-purple': '0 0 8px 0 rgba(163, 92, 255, 0.5)',
        'neon-glow': '0 0 15px 2px rgba(163, 92, 255, 0.6)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} 