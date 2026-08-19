import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Geist"', '"Inter var"', "Inter", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"Geist"', "system-ui", "sans-serif"],
      },
      colors: {
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          secondary: "hsl(var(--surface-secondary))",
          elevated: "hsl(var(--surface-elevated))",
          // Gradr design system: inset/hover fill role
          muted: "hsl(var(--surface-secondary))",
        },
        // Gradr design system brand palette
        shell: "var(--color-shell)",
        fog: "var(--color-fog)",
        harbor: {
          DEFAULT: "var(--color-harbor)",
          soft: "var(--color-harbor-soft)",
        },
        hull: {
          DEFAULT: "var(--color-hull)",
          soft: "var(--color-hull-soft)",
        },
        ink: "var(--color-ink)",
        slate: "var(--color-slate)",
        overlay: "hsl(var(--overlay))",
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
        brand: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          soft: "hsl(var(--primary-soft))",
          glow: "hsl(var(--primary-glow))",
          secondary: "hsl(var(--brand-secondary))",
          "secondary-hover": "hsl(var(--brand-secondary-hover))",
          "secondary-foreground": "hsl(var(--brand-secondary-foreground))",
          "secondary-soft": "hsl(var(--brand-secondary-soft))",
        },
        mahogany: {
          DEFAULT: "hsl(var(--mahogany))",
          foreground: "hsl(var(--mahogany-foreground))",
          hover: "hsl(var(--mahogany-hover))",
          strong: "hsl(var(--mahogany-strong))",
          muted: "hsl(var(--mahogany-muted))",
          soft: "hsl(var(--mahogany-soft))",
          tint: "hsl(var(--mahogany-tint))",
          border: "hsl(var(--mahogany-border))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Gradr design system
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      boxShadow: {
        // Gradr design system
        raise: "var(--shadow-raise)",
        float: "var(--shadow-float)",
      },
      fontSize: {
        // Gradr design system type scale — one class per semantic role
        h1: ["var(--text-h1, 3.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        h2: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "600" }],
        h3: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h4: ["1.375rem", { lineHeight: "1.3", fontWeight: "600" }],
        h5: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        h6: ["1rem", { lineHeight: "1.45", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.65" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        caption: ["0.8125rem", { lineHeight: "1.45" }],
        overline: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.09em", fontWeight: "600" }],
        button: ["0.875rem", { lineHeight: "1", letterSpacing: "0.005em", fontWeight: "500" }],
        code: ["0.8125rem", { lineHeight: "1.5" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up": "slide-up 0.4s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
