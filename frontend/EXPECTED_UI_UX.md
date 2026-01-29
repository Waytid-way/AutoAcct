# AutoAcct UI/UX Expectations

This document outlines the intended design aesthetic, user interface behavior, and user experience for the AutoAcct Anomaly Detection Module.

## 🎨 Design Philosophy
**"Muji Dark"** — A minimalist, content-focused dark theme that emphasizes data readability through subtle contrast rather than heavy borders.

*   **Primary Background**: Deep Black (`#0A0A0A`)
*   **Surface Color**: Dark Grey (`#141414`) for cards and containers
*   **Accent Color**: Trust Blue (`#3B82F6`) for primary actions and active states
*   **Typography**: Inter (Clean, sans-serif), highly legible

---

## 🖥️ Page Layout: Anomaly Dashboard

The dashboard is designed with a **F-Pattern** layout for quick scanning of critical issues.

### 1. Sidebar Navigation
*   **Position**: Fixed Left
*   **Appearance**: Dark Grey (`#141414`) background, distinct from the main content.
*   **Active State**: The "Anomalies" menu item should have a subtle blue background (`bg-accent-primary/10`) and blue text to indicate location.
*   **Brand**: "AutoAcct" logo at the top left in white/bold.

### 2. Statistics Overview (Top Row)
A 4-column grid of **Stat Cards** immediately greets the user.
*   **Total Anomalies**: Neutral styling.
*   **Critical**: **Red** (`#EF4444`) icon with a subtle red background tint (`bg-red-500/10`).
*   **Warnings**: **Amber** (`#F59E0B`) icon with amber tint.
*   **Resolved**: **Green** (`#10B981`) icon with green tint.
*   **Interaction**: Cards should lift slightly or brighten on hover (`border-color` change).

### 3. Main Content Area (Split View)
*   **Left Column (2/3 width)**: **Anomaly List**
    *   **Filter Bar**: A horizontal scrolling row of pills (All, Critical, Warning, Info).
        *   *Active Pill*: Solid Blue background.
        *   *Inactive Pill*: Grey background, hover effect.
    *   **List Items (Cards)**:
        *   Each anomaly is a distinct card.
        *   **Critical Items**: Should have a subtle red border or glow to demand attention.
        *   **Content**: Title (Bold), Description (Grey), Time (Right-aligned, dim).
        *   **Action Buttons**: "Dismiss" (Ghost) and "Review" (Primary Blue) visible on the card footer.
        *   **Expansion**: Clicking "More details" slides down extra information without leaving the page.

*   **Right Column (1/3 width)**: **Analytical Widgets**
    *   **Trend Analysis**: A container displaying insights.
    *   **AI Insight**: A highlighted box (Blue tint) offering actionable advice (e.g., "Recurring vendor issue").
    *   **Chart**: A visual representation (Line/Bar) of anomalies over time (currently a placeholder).

---

## 💡 User Interaction & Feedback

### Hover Effects
*   **Buttons**: Should brighten slightly.
*   **Cards**: Border color should transition from `#333` (Default/Subtle) to `#525252` (Stronger) on hover to indicate interactability.

### Loading States
*   **Skeleton Loading**: Instead of a spinning circle, use pulsing grey blocks (`animate-pulse`) that mimic the shape of text/cards to reduce perceived wait time.

### Responsiveness
*   **Desktop**: Full layout with Sidebar and Split structure.
*   **Mobile**: Sidebar turns into a Hamburger menu (or bottom nav). Grid becomes single column (Stacked).

---

## 🔍 Troubleshooting Styles (If it looks "Bad")
If the UI appears broken (e.g., white text on white background, missing grids), the likely causes are:
1.  **Tailwind Config Mismatch**: The custom color tokens (e.g., `bg-bg-app`) aren't matching the generated utility classes.
    *   *Fix*: Ensure `tailwind.config.ts` includes the `status` and `background` aliases (Done in Step 302).
2.  **CSS Variable Fallback**: Old browsers or caching might prevent CSS variables (`--bg-app`) from loading.
3.  **Global CSS Import**: Ensuring `globals.css` is imported at the very top of `layout.tsx`.

### Correct Color Reference
| Token Name | Hex Code | Visual usage |
| :--- | :--- | :--- |
| `bg-app` | `#0A0A0A` | Main Page Background (Deepest) |
| `bg-surface` | `#141414` | Card Background (Slightly lighter) |
| `text-primary` | `#ECECEC` | Main Headings |
| `text-secondary` | `#A3A3A3` | Descriptions / Metadata |
