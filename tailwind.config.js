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
      /**
       * The palette is «غروب بنفش» — a violet sky with coral, pink and amber.
       *
       * The whole site already speaks in these five names (cyan, sky, teal,
       * turquoise, saffron), so re-mapping the scales here re-themes every page
       * at once, instead of leaving one forgotten panel in the old colours.
       * Emerald (success) and rose (error) keep their meaning.
       */
      colors: {
        night: {
          950: "#0a0716",
          900: "#120a26",
          800: "#1b1036",
          700: "#261548",
          600: "#331b60",
        },
        cyan: {
          50: "#f6f2ff",
          100: "#ece4ff",
          200: "#dbcdff",
          300: "#c3a9ff",
          400: "#a97dff",
          500: "#8f56f7",
          600: "#7b34e0",
          700: "#6823bb",
          800: "#541c96",
          900: "#431878",
          950: "#2b0f52",
        },
        sky: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a9b6ff",
          400: "#8391ff",
          500: "#6366f1",
          600: "#5145d8",
          700: "#4136b0",
          800: "#352e8c",
          900: "#2c2873",
          950: "#1a1745",
        },
        teal: {
          50: "#fff1f4",
          100: "#ffe0e8",
          200: "#ffc6d6",
          300: "#ff9db8",
          400: "#ff6f98",
          500: "#ff3d7f",
          600: "#ef1f6d",
          700: "#c9135b",
          800: "#a51250",
          900: "#8a1449",
          950: "#4d0724",
        },
        turquoise: {
          50: "#fff8ed",
          100: "#fff1d6",
          200: "#ffe0a9",
          300: "#ffc971",
          400: "#ffab3d",
          500: "#ff8a1f",
          600: "#f06a08",
          700: "#c74d09",
          800: "#9e3d10",
          900: "#7f3411",
          950: "#451806",
        },
        saffron: {
          300: "#ffb894",
          400: "#ff8f5e",
          500: "#ff6f3c",
          600: "#e8501f",
        },
      },
      boxShadow: {
        glow: "0 0 60px -15px rgba(169, 125, 255, 0.5)",
        warm: "0 0 55px -18px rgba(255, 111, 152, 0.55)",
        card: "0 24px 60px -30px rgba(20, 6, 40, 0.85)",
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
