import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wine: {
          50: "#fff5f6",
          100: "#f7dfe3",
          600: "#8b1f33",
          700: "#74182a",
          900: "#3b0d16"
        },
        paper: "#f8f1e8",
        ink: "#2b2020",
        olive: "#647447",
        sea: "#2f6f73"
      },
      boxShadow: {
        soft: "0 14px 35px rgba(59, 13, 22, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
