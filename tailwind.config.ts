import type { Config } from "tailwindcss";

// Colors and fonts come only from the CSS variables in client/src/index.css.
// This file maps semantic names to them; it holds no color values itself.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const px = (sizes: number[]) => Object.fromEntries(sizes.map(s => [String(s), `${s}px`]));

export default {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: token("ground"),
        surface: token("surface"),
        ink: { DEFAULT: token("ink"), soft: token("ink-soft") },
        muted: { DEFAULT: token("muted"), foreground: token("muted") },
        neutral: { DEFAULT: token("neutral"), line: token("neutral-line") },
        placeholder: token("placeholder"),
        control: token("control"),
        line: token("line"),
        track: token("track"),
        stripe: token("stripe"),
        wash: token("wash"),
        hairline: token("hairline"),
        physiology: {
          DEFAULT: token("physiology"),
          strong: token("physiology-strong"),
          "range-line": token("physiology-range-line"),
          range: token("physiology-range"),
          quiet: token("physiology-quiet"),
          wash: token("physiology-wash"),
        },
        exposure: {
          DEFAULT: token("exposure"),
          strong: token("exposure-strong"),
          mid: token("exposure-mid"),
          wash: token("exposure-wash"),
          field: token("exposure-field"),
        },
        alert: token("alert"),
        shadow: token("shadow"),

        // shadcn/ui aliases (used by the toast primitive), mapped onto the tokens above.
        background: token("ground"),
        foreground: token("ink"),
        border: token("line"),
        input: token("control"),
        ring: token("physiology"),
        card: { DEFAULT: token("surface"), foreground: token("ink"), border: token("line") },
        popover: { DEFAULT: token("surface"), foreground: token("ink"), border: token("line") },
        primary: { DEFAULT: token("ink"), foreground: token("surface"), border: token("ink") },
        secondary: { DEFAULT: token("wash"), foreground: token("ink"), border: token("line") },
        accent: { DEFAULT: token("wash"), foreground: token("ink"), border: token("line") },
        destructive: { DEFAULT: token("alert"), foreground: token("surface"), border: token("alert") },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        serif: ["var(--font-serif)"],
      },
      // The design's type sizes, in px: text-11, text-13, text-34 …
      fontSize: px([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 40, 44, 48]),
      letterSpacing: {
        eyebrow: "0.1em",
        header: "0.08em",
        badge: "0.06em",
      },
      borderRadius: {
        card: "14px",
        tile: "12px",
        control: "10px",
        badge: "6px",
        pill: "22px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      maxWidth: {
        phone: "390px",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
