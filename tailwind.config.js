/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        red: {
          bus:  '#C8102E',
          dark: '#9B0B22',
          deep: '#6B0718',
        },
        cream: '#FFF8F0',
        'warm-white': '#FFFCF9',
        gold: '#F5C518',
      },
      fontFamily: {
        bebas: ['var(--font-bebas)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
