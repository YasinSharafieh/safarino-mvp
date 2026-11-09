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
          950: "#031018",
          900: "#071521",
          800: "#0b2331",
          700: "#103547",
          600: "#16485c",
        },
        saffron: {
          300: "#a5f3fc",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        turquoise: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0e7490",
        },
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(6, 182, 212, 0.45)",
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
