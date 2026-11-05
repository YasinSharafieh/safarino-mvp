/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Vazirmatn",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Tahoma",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#f4f1ff",
          100: "#ebe4ff",
          200: "#d9cdff",
          300: "#bfa6ff",
          400: "#a175ff",
          500: "#8540ff",
          600: "#7a1dff",
          700: "#6a0df2",
          800: "#590bcb",
          900: "#4a0ba6",
          950: "#2b0370",
        },
        night: {
          900: "#070713",
          800: "#0b0b1c",
          700: "#12122a",
        },
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(140, 70, 255, 0.55)",
        card: "0 30px 60px -30px rgba(0, 0, 0, 0.85)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to left, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "pulse-glow": "pulse-glow 6s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [],
};
