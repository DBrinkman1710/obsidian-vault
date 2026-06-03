import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
