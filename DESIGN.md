---
name: Gamified PAES Prep
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#584237'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#8c7164'
  outline-variant: '#e0c0b1'
  surface-tint: '#9d4300'
  primary: '#9d4300'
  on-primary: '#ffffff'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#ffb690'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#b91a24'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff6a64'
  on-tertiary-container: '#6c000b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  primary-pressed: '#c2410c'
  primary-hover: '#ea580c'
  primary-accent: '#fb923c'
  primary-tint: '#ffedd5'
  secondary-tint: '#eef2ff'
  tertiary-tint: '#fef2f2'
  success-mastery: '#10b981'
  surface-canvas: '#f8fafc'
  border-subtle: '#e2e8f0'
  text-muted: '#64748b'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 26px
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 22px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system powers a high-energy, gamified preparation experience for standardized admission testing (PAES). Blending the dopamine-driven engagement loops of modern micro-learning apps (such as Duolingo) with rigorous academic performance tracking, the visual language balances playful motivation and clear educational utility.

The aesthetic fuses **Modern Tactile Gamification** with crisp, content-first dashboards:
- **Tone & Mood:** Encouraging, competitive, agile, and clear. It transforms exam dread into daily measurable wins (streaks, league tables, mastery nodes).
- **Visual Personality:** Rounded cards, punchy orange primary accents, tactile 3D-styled action triggers, pill badges, and structured modular progress maps.
- **Audience:** High school seniors and pre-university students who expect clean mobile-first UI patterns, lightning-fast quiz loops, and instantaneous visual feedback.

## Colors

The palette replaces the traditional, clinical study hues with an energizing warm spectrum driven by vibrant orange, balanced with thematic subject colors and decisive alert states.

### Core Roles
- **Primary (`#F97316` / `#EA580C`):** The engine of momentum. Used for streaks, primary call-to-actions, active quest progress, and milestone unlocks.
  - *Container / Surface Highlights:* `#FFEDD5` (Warm Cream).
  - *Hover / Pressed Deep Tone:* `#C2410C`.
  - *Vibrant Accent:* `#FB923C`.
- **Secondary (`#6366F1` / `#4F46E5`):** Reserved for academic knowledge tracks, stem concepts, mathematical functions, and competitive leagues (Diamond League, Algebra trees).
  - *Secondary Tint Surface:* `#EEF2FF`.
- **Tertiary / Diagnostic Alert (`#EF4444` / `#DC2626`):** Dedicated to weak-point diagnostics, low-accuracy alerts ("Talón de Aquiles"), and countdown timers.
  - *Alert Surface Tint:* `#FEF2F2`.
- **Success / Mastery Accent (`#10B981`):** Retained strictly for completed nodes, 100% mastery checks, and correct answer feedback.
- **Neutrals & Surfaces:**
  - *App Canvas:* `#F8FAFC` (Cool Off-White).
  - *Card & Elevated Surface:* `#FFFFFF`.
  - *Subtle Border / Stroke:* `#E2E8F0`.
  - *Primary Typography:* `#0F172A` (Slate 900).
  - *Secondary / Label Typography:* `#64748B` (Slate 500).

## Typography

**Plus Jakarta Sans** serves as the single typographic family across display, body, and label roles. Its geometric construction, generous x-height, and contemporary friendly curves align naturally with gamified interfaces without sacrificing readability in complex formulas or dense diagnostic reports.

- **Numerics & Scores:** `display-lg` and `headline-xl` feature tabular lining figures and heavy weights (`800`) to celebrate score achievements, consecutive streak counts, and XP bonuses.
- **Section Headers & Category Eyebrows:** Set in `label-caps` with uppercase tracking (`+0.05em`) to structure content hierarchy cleanly across dashboard cards.
- **Content & Questions:** `body-lg` and `body-md` maintain a balanced `500` weight to ensure prolonged reading comfort during timed practice sets.

## Layout & Spacing

The interface uses an adaptive multi-column responsive model tailored for both rapid on-the-go practice on mobile devices and comprehensive study sessions on desktop.

- **Desktop Layout (≥ 1200px):** 12-column grid system with a persistent slim sidebar or sticky top utility bar, a centered primary learning path (5-6 columns), and contextual side panels (4-5 columns) for active streaks, league leaderboards, and weakness radar.
- **Tablet (768px – 1199px):** 8-column layout where learning modules take center stage and secondary stats stack below or into toggleable slide-over sheets.
- **Mobile (< 768px):** Single-column stacked stream with fixed bottom navigation. Top bar displays essential currencies (Streak flame, XP diamond, PAES goal metric).
- **Rhythm:** An 8pt spatial baseline strictly governs inner card padding (`space-md` to `space-lg`) and component gaps (`space-sm` to `space-md`), creating compact information density suited for dashboards.

## Elevation & Depth

Visual hierarchy uses a hybrid approach of **tactile layering, crisp low-contrast borders, and warm ambient diffusion**:

- **Ground Level (Canvas):** Base tone `#F8FAFC` flat surface.
- **Surface Level 1 (Cards & Hubs):** Pure white `#FFFFFF` cards wrapped in a hairline stroke `1px solid #E2E8F0`, elevated by a soft ambient shadow: `0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 4px -1px rgba(15, 23, 42, 0.03)`.
- **Surface Level 2 (Floating Floating Path Nodes & Tooltips):** Modals, current node pointers, and dropdown sheets use elevated drop shadows: `0 10px 25px -5px rgba(249, 115, 22, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`.
- **Gamified Tactile Depth (Buttons & Interactive Path Nodes):** Actionable triggers feature a subtle physical "pressable" offset: a solid bottom border (`box-shadow: 0 4px 0 0 #C2410C` for primary buttons, and `0 4px 0 0 #CBD5E1` for neutral cards). When active or pressed, the element translates `2px` downwards, mimicking tactile button clicks.

## Shapes

The system adopts a friendly, accessible **Rounded (Level 2)** shape identity:
- **Base Components (Inputs, Buttons, Badges):** `0.75rem` (12px) for comfortable touch targets and rounded visual tactility.
- **Cards & Progress Containers:** `1rem` (16px) to `1.25rem` (20px), softening analytical data and making dense study metrics inviting.
- **Progress Track Bars & Pill Indicators:** Completely circular (`9999px`) rounded caps for fluid learning bars, status pills, and numeric XP badges.
- **Skill Tree Nodes:** Spherical hubs (`w-14 h-14` or `w-16 h-16`) encased in outer concentric rings with pulse animations for active modules.

## Components

### 1. Primary Action Buttons
- **Style:** Energetic orange background (`#F97316`), bold label in pure white, with tactile bottom edge (`box-shadow: 0 4px 0 0 #C2410C`).
- **States:** Hover intensifies background to `#EA580C`; active state translates the button downward by `2px` with shadow reduced to `0 2px 0 0 #C2410C`.
- **Secondary Variant:** White background, `1.5px solid #E2E8F0`, slate text with `0 3px 0 0 #E2E8F0` bottom edge.

### 2. Gamified Path Nodes (Learning Route)
- **Completed Node:** Solid Emerald (`#10B981`) circle with white checkmark icon and small `+20 XP` tag beneath.
- **Active Node (Current Focus):** Pulsing Orange (`#F97316`) or Violet node surrounded by a floating halo (`#FFEDD5` ring), crowned with an interactive tooltip card displaying module name, DEMRE classification, and a "Continuar Lección" trigger.
- **Locked Node:** Cool slate background (`#E2E8F0`), padlocked icon (`#94A3B8`), devoid of tactile depth until prerequisite unlocks.

### 3. Metric & Diagnostic Cards
- **Streak & Goal Counter:** White card with upper label in uppercase `label-caps`, featuring oversized bold metrics paired with thematic icons (flame for streak, graduation cap for target score).
- **Weakness Alert ("Talón de Aquiles"):** Light red-tinted container (`#FEF2F2`) framed with a subtle border (`#FCA5A5`), showcasing failure percentages, diagnostic tags, and an instant "Flash Quiz" call-to-action button in deep crimson (`#DC2626`).

### 4. Progress Bars
- Dual-tone linear bars with full pill radius (`rounded-full`). Background is `#F1F5F9`; fill is either dynamic primary gradient (`#F97316` to `#FB923C`) or subject indigo (`#6366F1`). Includes animated shimmer on level completion.

### 5. Leaderboards & Avatars
- Row elements featuring ranking numbers (`1`, `2`, `3` as gold, silver, and bronze badges), circular avatar with status border, username with school/institution subtext, and right-aligned bold XP badge. The user's row is highlighted with an active `#FFEDD5` container and orange indicator border.

### 6. Chips & Badges
- Compact pill-shaped chips (`px-3 py-1`) using low-saturation backgrounds (`#EEF2FF` for Math, `#FFEDD5` for Streaks, `#FEF2F2` for Critical) with crisp saturated typography matching the parent tint.