# Design System — HUS Learning Hub

## Visual World

**Atmospheric Observatory (Bầu trời & Đài thiên văn học thuật)** — an airy, celestial academic environment inspired by natural science at VNU University of Science (ĐHKHTN, ĐHQGHN). Landing surfaces open with luminous daylight or deep starlit midnight, crisp orbital SVG geometry, and poetic display typography, while course and lesson reading surfaces recede into calm, distraction-free focus.

## Color Tokens

### Light Mode (Morning Observatory Sky)

| Token | Hex / Value | Role |
| --- | --- | --- |
| `--hus-canvas` | `#f7f9fc` | Primary page ground |
| `--hus-surface` | `#ffffff` | Elevated cards, floating nav, panels |
| `--hus-surface-subtle` | `#eef3f9` | Secondary panels, code/quote blocks |
| `--hus-surface-hover` | `#e4ecf6` | Hover state background |
| `--hus-border` | `#dfe6f0` | Hairline dividers & full-perimeter borders |
| `--hus-border-strong` | `#c6d3e3` | Emphasized interactive borders |
| `--hus-ink` | `#0e1726` | Primary text & headings |
| `--hus-ink-secondary` | `#38475e` | Body copy & descriptions |
| `--hus-ink-muted` | `#586980` | Captions, metadata, placeholders |
| `--hus-accent` | `#1a56db` | Primary Celestial Sapphire links & focus |
| `--hus-accent-solid` | `#1a56db` | Primary CTA fill (white text ≥ 6.3:1) |
| `--hus-accent-solid-hover` | `#1543ad` | Primary CTA hover fill |
| `--hus-accent-subtle` | `#e8f0fe` | Active nav & selection tint |
| `--hus-starlight` | `#b07a22` | Subtle orbital starlight accent nodes |

### Dark Mode (Deep Starlit Observatory)

| Token | Hex / Value | Role |
| --- | --- | --- |
| `--hus-canvas` | `#090e18` | Deep nocturnal page ground |
| `--hus-surface` | `#101726` | Elevated panels & floating nav |
| `--hus-surface-subtle` | `#162033` | Secondary panels & code blocks |
| `--hus-surface-hover` | `#1d2a42` | Hover state background |
| `--hus-border` | `#1f2d45` | Hairline dividers & borders |
| `--hus-border-strong` | `#2f4263` | Emphasized borders |
| `--hus-ink` | `#eef2f8` | Starlight ivory primary ink |
| `--hus-ink-secondary` | `#b6c3d7` | Body copy & descriptions |
| `--hus-ink-muted` | `#8596b0` | Metadata & captions |
| `--hus-accent` | `#7cb3ff` | Luminous sky-sapphire links & focus |
| `--hus-accent-solid` | `#2563eb` | Primary CTA fill (white text ≥ 5.17:1) |
| `--hus-accent-solid-hover` | `#1d4ed8` | Primary CTA hover fill |
| `--hus-accent-subtle` | `#152440` | Active nav & selection tint |
| `--hus-starlight` | `#e4bc6a` | Subtle orbital starlight accent nodes |

## Typography

All fonts are self-hosted locally in `src/assets/fonts/` with full Vietnamese diacritic subsets (`vietnamese`, `latin-ext`, `latin`) and zero external CDN calls:

- **Display (`--font-display`)**: `Spectral` (300, 400, 500, 600; no italics). Used for `.heading-display` (36px → 60px), `.heading-tagline` (30px → 48px), `.heading-page` (30px → 36px), and `.heading-section` (24px).
- **UI & Reading (`--font-sans`)**: `Be Vietnam Pro` (400, 500, 600). Used for navigation, controls, cards, metadata, and `.academic-prose` (`66ch` measure, 16px/18px toggleable reading scale).
- **Monospace (`--font-mono`)**: `ui-monospace` with `tabular-nums` for course codes, counts, progress percentages, and code blocks.

## Motion & Geometry

- **Easing**: `--hus-ease: cubic-bezier(0.22, 1, 0.36, 1)` (weighted deceleration).
- **Signature Landing Moments**:
  - `ObservatoryCanvas`: pure vector SVG astrolabe orbits with slow GPU-only rotation (`110s` / `84s`) and soft zenith diffusion.
  - `TaglineReveal`: `IntersectionObserver` + `requestAnimationFrame` word-by-word illumination on scroll.
  - `ScrollReveal`: one-shot gentle vertical rise on viewport entry.
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` immediately disables all orbital, entrance, and scroll animations and forces full visibility (`opacity: 1; transform: none`).

## Shell & Component Grammar

- **Navigation**: Floating translucent rounded top bar (`rounded-xl`, `backdrop-blur-xl`, full-perimeter border) with custom astrolabe HUS brand emblem, `/` global search shortcut, theme toggle, and full-height blurred mobile drawer with staggered link entrance.
- **Surfaces**: Full-perimeter hairline borders paired with hue-tinted soft shadows (`.hus-card-surface`), never single-sided card borders or eyebrow kickers above headings.
