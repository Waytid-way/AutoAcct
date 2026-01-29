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
                // Backgrounds (Hardcoded Hex for stability)
                bg: {
                    app: "#0A0A0A",
                    surface: "#141414",
                    "surface-hover": "#1A1A1A",
                    input: "#0F0F0F",
                    subtle: "#1A1A1A",
                },
                background: {
                    app: "#0A0A0A",
                    surface: "#141414",
                    subtle: "#1A1A1A",
                },

                // Borders
                border: {
                    subtle: "#262626",
                    default: "#333333",
                    active: "#404040",
                },

                // Text
                text: {
                    primary: "#ECECEC",
                    secondary: "#A3A3A3",
                    tertiary: "#737373",
                },

                // Accent - Trust Blue
                accent: {
                    primary: "#3B82F6",
                },

                // Status Colors
                status: {
                    success: "#10B981",
                    warning: "#F59E0B",
                    error: "#EF4444",
                    info: "#6366F1",
                },

                // Direct access aliases
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
                info: "#6366F1",
            },
            spacing: {
                // Approximate pixel values for variables
                unit: "8px",
                component: "24px",
                section: "32px",
            },
            transitionDuration: {
                DEFAULT: "150ms",
            },
            transitionTimingFunction: {
                DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
            },
            borderRadius: {
                DEFAULT: "12px",
            },
        },
    },
    plugins: [],
};

export default config;
