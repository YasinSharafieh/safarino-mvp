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
          950: "#04060f",
          900: "#05070f",
          800: "#0a1020",
          700: "#111a2f",
          600: "#1b2743",
        },
        saffron: {
          300: "#ffdd9a",
          400: "#ffc24d",
          500: "#f59e0b",
          600: "#d97706",
        },
        turquoise: {
          300: "#7fe0e5",
          400: "#38bdc4",
          500: "#14a3ab",
          600: "#0e7f86",
        },
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(245, 158, 11, 0.45)",
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
