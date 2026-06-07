/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tz-green': '#374F4E',
        'tz-orange': '#D1801E',
        'tz-peach': '#EDBD95',
        'tz-beige': '#DACCC4',
        'tz-brown': '#AA8552',
      }
    },
  },
  plugins: [],
}
