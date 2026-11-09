/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      colors: {
        night: {
          950: "#02110e",
          900: "#061a17",
          800: "#0b2923",
          700: "#103c32",
          600: "#175344",
        },
        saffron: {
          300: "#a7f3d0",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        turquoise: {
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0f766e",
        },
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(16, 185, 129, 0.45)",
        card: "0 24px 60px -30px rgba(0, 0, 0, 0.85)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        shine: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        shine: "shine 6s linear infinite",
      },
    },
  },
  plugins: [],
};
