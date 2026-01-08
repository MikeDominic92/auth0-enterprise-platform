/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#EB5424', // Auth0 Orange
        background: '#F7F8FA',
        text: '#1E1E1E',
        success: '#00D084',
        warning: '#FFB020',
        error: '#D14343',
        info: '#635DFF',
      }
    },
  },
  plugins: [],
}

