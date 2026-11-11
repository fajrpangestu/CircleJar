/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.ejs'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
