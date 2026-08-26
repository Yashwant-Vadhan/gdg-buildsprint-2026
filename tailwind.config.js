/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
    },
  },
  plugins: [],
};
