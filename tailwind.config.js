/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Couleurs du logo BE FOR NOR KA
        primary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        // Couleurs vertes tropicales
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Couleurs d'accent orange tropical
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Glass effect colors
        glass: {
          light: 'rgba(255, 255, 255, 0.1)',
          medium: 'rgba(255, 255, 255, 0.2)',
          dark: 'rgba(0, 0, 0, 0.1)',
        }
      },
      backgroundImage: {
        'tropical-gradient': 'linear-gradient(135deg, #fdf2f8 0%, #f0fdf4 50%, #fffbeb 100%)',
        'primary-gradient': 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
        'secondary-gradient': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'accent-gradient': 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)',
        'card-gradient': 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(253, 242, 248, 0.85) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
        'float': 'float 4s ease-in-out infinite',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'modern': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'hover': '0 32px 64px -12px rgba(0, 0, 0, 0.25)',
      }
    },
  },
  plugins: [],
};