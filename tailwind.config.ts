import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ['class', '.theme-dark'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Brand Book role-based tokens
        headline: ["Clash Grotesk", "sans-serif"],
        display:  ["Clash Grotesk", "sans-serif"],
        body:     ["Inter Tight", "sans-serif"],
        label:    ["Inter Tight", "sans-serif"],
        mono:     ["JetBrains Mono", "Courier New", "monospace"],
        // Backward compat aliases
        sans:     ["Inter Tight", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          carbon: "#121212",
          pearl: "#F9F9F9",
          amber: "#FF8C00",
          cobalt: "#0047AB",
          emerald: "#043927",
          deepViolet: "#5B2D8E",
          vividGreen: "#22C55E",
          50: "#f5f5f5",
          100: "#e8e8e8",
          200: "#d0d0d0",
          300: "#a8a8a8",
          400: "#737373",
          500: "#FF8C00", // Amber default
          600: "#e67e22",
          700: "#262626",
          800: "#171717",
          900: "#121212", // Carbon default
          950: "#0a0a0a",
          dark: "#121212",
          DEFAULT: "#FF8C00",
          // Semantic aliases for portal/dashboard components
          primary: "var(--text)",
          secondary: "var(--text-2)",
          muted: "var(--text-3)",
          surface: "var(--surface)",
          "surface-1": "rgb(var(--surface-rgb) / <alpha-value>)",
          "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
          subtle: "var(--border)",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        error: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        info: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        purple: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          900: "#581c87",
        },
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      transitionDuration: {
        DEFAULT: "200ms",
        fast: "150ms",
        slow: "300ms",
        page: "600ms",
      },
    },
  },
  plugins: [],
};

export default config;
