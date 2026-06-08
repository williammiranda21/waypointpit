/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Waypoint design tokens — must stay in sync with Waypoint HMIS.
        sidebar: {
          bg: '#111827',
        },
        primary: {
          DEFAULT: '#22C55E',
          hover: '#16A34A',
          light: '#DCFCE7',
        },
        'page-bg': '#F3F4F6',
        'card-bg': '#FFFFFF',
        'wp-border': '#E5E7EB',
        'text-primary': '#111827',
        'text-body': '#374151',
        'text-muted': '#6B7280',
        status: {
          active: '#22C55E',
          pending: '#3B82F6',
          alert: '#EF4444',
        },
      },
      borderRadius: {
        xl: '0.75rem', // matches HMIS card radius (12px)
        '2xl': '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(17, 24, 39, 0.04)',
        card: '0 1px 2px 0 rgba(17, 24, 39, 0.04), 0 1px 3px 0 rgba(17, 24, 39, 0.06)',
      },
      maxWidth: {
        sidebar: '16rem', // w-64
      },
    },
  },
  plugins: [],
};
