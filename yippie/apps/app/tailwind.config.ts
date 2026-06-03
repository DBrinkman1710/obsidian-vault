import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef8fd",
          100: "#d5eef9",
          200: "#aaddf3",
          300: "#72c7eb",
          400: "#5bb8e8",
          500: "#3aa3d8",
          600: "#2788b8",
          700: "#1e6d95",
          800: "#185578",
          900: "#124060",
        },
        navy: {
          50: "#f0f4f9",
          100: "#dae3f0",
          600: "#1e4a7c",
          700: "#1a3f6b",
          800: "#162f52",
          900: "#1e3a5f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
