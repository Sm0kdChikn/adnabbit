import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "background-elevated": "var(--background-elevated)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "var(--surface)",
          hover: "var(--surface-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          strong: "var(--muted-strong)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-dim)",
        },
        "on-accent": "var(--on-accent)",
        brand: {
          bg: "#0B0F14",
          elevated: "#12181F",
          surface: "#161D27",
          border: "#243041",
          cyan: "#00E5FF",
          text: "#E8EEF6",
          muted: "#94A3B8",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "var(--accent-glow)",
        "glow-sm": "0 0 12px color-mix(in srgb, var(--accent) 25%, transparent)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};
export default config;
