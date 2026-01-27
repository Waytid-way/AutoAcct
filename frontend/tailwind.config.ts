import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    app: "rgb(var(--bg-app) / <alpha-value>)",
                    surface: "rgb(var(--bg-surface) / <alpha-value>)",
                    "surface-hover": "rgb(var(--bg-surface-hover) / <alpha-value>)",
                    input: "rgb(var(--bg-input) / <alpha-value>)",
                },
                border: {
                    subtle: "rgb(var(--border-subtle) / <alpha-value>)",
                    default: "rgb(var(--border-default) / <alpha-value>)",
                    active: "rgb(var(--border-active) / <alpha-value>)",
                },
                text: {
                    primary: "rgb(var(--text-primary) / <alpha-value>)",
                    secondary: "rgb(var(--text-secondary) / <alpha-value>)",
                    tertiary: "rgb(var(--text-tertiary) / <alpha-value>)",
                },
                accent: {
                    primary: "rgb(var(--accent-primary) / <alpha-value>)",
                },
                success: "rgb(var(--success) / <alpha-value>)",
                warning: "rgb(var(--warning) / <alpha-value>)",
                error: "rgb(var(--error) / <alpha-value>)",
                info: "rgb(var(--info) / <alpha-value>)",
            },
            spacing: {
                unit: "var(--spacing-unit)",
                component: "var(--spacing-component)",
                section: "var(--spacing-section)",
            },
            transitionDuration: {
                DEFAULT: "var(--transition-duration)",
            },
            transitionTimingFunction: {
                DEFAULT: "var(--transition-easing)",
            },
            fontSize: {
                xs: ["0.75rem", { lineHeight: "1rem" }],     // 12px
                sm: ["0.875rem", { lineHeight: "1.25rem" }], // 14px
                base: ["1rem", { lineHeight: "1.5rem" }],    // 16px
                lg: ["1.125rem", { lineHeight: "1.75rem" }], // 18px
                xl: ["1.5rem", { lineHeight: "2rem" }],      // 24px
            },
            borderRadius: {
                DEFAULT: "12px",
            },
        },
    },
    plugins: [],
};

export default config;
