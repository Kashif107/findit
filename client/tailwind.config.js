export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17212b',
        brand: { 50: '#eefbf9', 100: '#d3f5ef', 500: '#14a394', 600: '#0f8678', 700: '#0d6b61' }
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
};
