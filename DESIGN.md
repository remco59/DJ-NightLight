---
name: DJ NightLight
description: A dark, violet-lit nightclub interface for a working DJ's public site and back office, with white pill actions and tight, heavy Archivo type.
colors:
  electric-accent: "#9d5cff"
  electric-soft: "#eadcff"
  electric-haze: "rgba(109, 40, 217, .14)"
  violet-selected: "#7c3aed"
  surface-page: "#08080b"
  surface-input: "#0b0a0d"
  surface-card: "#100e14"
  surface-raised: "#17141c"
  border: "#29242f"
  border-strong: "#332e39"
  text: "#f6f3fa"
  text-muted: "#aaa4b1"
  text-subtle: "#9a93a4"
  button-primary-bg: "#ffffff"
  button-primary-fg: "#09080b"
  button-secondary-bg: "#211c27"
  button-secondary-fg: "#eee9f2"
  button-danger-bg: "#2a1519"
  button-danger-fg: "#ffabb5"
  status-ok: "#22c55e"
  status-warn: "#f59e0b"
  status-danger: "#ef4444"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.8rem, 7.6vw, 8rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 3.4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.77rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.17em"
  meta:
    fontFamily: "SFMono-Regular, Roboto Mono, Cascadia Mono, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.04em"
rounded:
  sm: "0.5rem"
  md: "0.65rem"
  lg: "1rem"
  xl: "1.25rem"
  pill: "999px"
spacing:
  xs: ".4rem"
  sm: ".75rem"
  md: "1.25rem"
  lg: "3rem"
  xl: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.button-primary-bg}"
    textColor: "{colors.button-primary-fg}"
    rounded: "{rounded.pill}"
    padding: ".78rem 1.2rem"
    height: "2.9rem"
  button-secondary:
    backgroundColor: "rgba(12, 10, 15, .48)"
    textColor: "#eeeaf2"
    rounded: "{rounded.pill}"
    padding: ".78rem 1.2rem"
    height: "2.9rem"
  button-admin:
    backgroundColor: "#131118"
    textColor: "#e9e5ee"
    rounded: "{rounded.md}"
    padding: ".55rem .95rem"
    height: "2.6rem"
  button-admin-primary:
    backgroundColor: "{colors.button-primary-bg}"
    textColor: "{colors.button-primary-fg}"
    rounded: "{rounded.md}"
    padding: ".55rem .95rem"
    height: "2.6rem"
  button-danger:
    backgroundColor: "#1b0f13"
    textColor: "#f39aa6"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "#0f0d13"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: ".6rem .75rem"
    height: "2.6rem"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: "1.3rem"
  tag:
    backgroundColor: "#19161f"
    textColor: "#c9c2d1"
    rounded: "{rounded.pill}"
    padding: ".2rem .62rem"
  menu-panel:
    backgroundColor: "#131118"
    rounded: "{rounded.md}"
    padding: ".4rem"
---

# Design System: DJ NightLight

## Overview

**Creative North Star: "The Lit Booth"**

The whole system is a dark room with one source of light. Near-black violet surfaces carry the interface, a single electric violet (#9d5cff) glows at the edges, and everything else is white type and white pill buttons. It should feel like standing in front of a DJ booth at night, not like a SaaS dashboard dressed in dark mode.

The public site and the back office share the same tokens and the same voice, with different density. The public site is editorial: oversized Archivo headlines at 0.9 line-height, big gaps, full-bleed photography, hairline dividers, and mono-spaced metadata (dates, locations, counts) set like a setlist. The back office is the same world made compact and mobile-first: smaller controls, a bottom navigation on phones, bottom sheets, and rounded-rectangle controls instead of pills.

Light is a recurring signature, used sparingly. A short gradient hairline fading from violet to transparent appears under eyebrows, above the footer, and beside visual beats. Violet haze radial glows sit off-canvas in page corners. Nothing is lit all over.

**Key Characteristics:**
- Dark only. `color-scheme: dark`; there is no light theme.
- One accent hue (violet), used for glow, active state and hairlines, never as a large fill.
- White pill as the single primary action, site-wide and in the back office.
- Heavy, tightly tracked Archivo for headlines; mono for metadata.
- Tonal layering plus hairline borders for depth; shadows only on floating layers.
- Focus is always visible (lavender outline), contrast is checked (4.5:1 minimum on raised surfaces).

## Colors

A near-black violet-tinted neutral ramp, one electric violet accent, white as the action color, and conventional status hues.

### Primary
- **Electric Violet** (#9d5cff): the glow color. Eyebrow rules, active nav underlines, meta highlights, hover halos. Used on well under 10% of any screen.
- **Lavender Mist** (#eadcff): the soft partner of Electric Violet. Active mobile nav item, hover border on the primary button, the end of the nav underline gradient.
- **Selected Violet** (#7c3aed): filled selection states only (checked media checkbox).

### Neutral
- **Stage Black** (#08080b): page background, with a violet radial glow top-right.
- **Input Well** (#0b0a0d): the deepest surface, behind form fields.
- **Booth Panel** (#100e14): cards and containers.
- **Raised Panel** (#17141c): popovers, hovered rows, anything above a card.
- **Hairline** (#29242f) and **Hairline Strong** (#332e39): borders and dividers.
- **Paper White** (#f6f3fa): primary text, and the fill of the primary button (#ffffff).
- **Mist** (#aaa4b1) and **Dim Mist** (#9a93a4): secondary and tertiary text; both stay at 4.5:1 or better on Raised Panel.

### Status
- **Go Green** (#22c55e), **Amber Cue** (#f59e0b), **Alarm Red** (#ef4444): status dots and chips only. Chips use a tinted border plus a pale text tone, never a solid fill.

### Named Rules
**The One Light Rule.** Violet is the only chromatic accent on any screen. It marks light (a glow, a hairline, an active state), never a surface. A violet button or violet card background is wrong.

**The White Action Rule.** The primary action is white on near-black, everywhere. Do not introduce a colored primary button.

## Typography

**Display Font:** Archivo (variable, 100 to 900, with italic; self-hosted woff2, `font-display: swap`)
**Body Font:** Archivo
**Label/Mono Font:** system mono stack (SFMono-Regular, Roboto Mono, Cascadia Mono, Consolas)

**Character:** One grotesque family doing everything, differentiated by weight and tracking: very heavy and tight for headlines, light and generous for reading, and mono for the factual details of a night (date, venue, count).

### Hierarchy
- **Display** (800, clamp(3.8rem, 7.6vw, 8rem), 0.9, -0.04em): page titles on the public site. Max width 14ch, balanced wrapping. Drops to clamp(3.25rem, 16vw, 5.5rem) on phones.
- **Headline** (800, clamp(1.8rem, 3.4vw, 3.5rem), 1, -0.04em): section and gig titles.
- **Title** (800, 1.25rem): card and panel headings, back-office section headings.
- **Body** (400, 1rem to 1.38rem, 1.65 to 1.7): lead copy sits at 1.08 to 1.38rem in Mist; keep to about 48rem measure.
- **Label** (650, .77rem, .17em, uppercase): the eyebrow, always followed by a short violet gradient rule.
- **Meta** (mono, .7 to .88rem, .035 to .055em, tabular-nums): dates, locations, indexes, counts, showreel details.

### Named Rules
**The Tight Heavy Rule.** Anything set large is weight 800 with -0.04em tracking and line-height at or below 1. Anything set small is not. No middle ground of medium-weight, loosely tracked headings.

**The Setlist Rule.** Facts about an event (date, time, venue, count) are mono and often uppercase. Prose is Archivo. Do not mix the two inside one sentence.

## Layout

Two containers: a 1180px `.container` for back-office-style content and a wider 1320px `.public-container` for the public site, both with 1.5 to 2.5rem side gutters (1rem on phones). Public pages open with a large top offset (10.5rem, 8.5rem on phones) to clear the fixed header, then breathe: sections are separated by clamp(4rem, 10vw, 10rem), not by borders.

The public layout is editorial and asymmetric: a sticky narrow intro column beside a wide list, a 12-column gallery whose items alternate span 5 and span 7, a full-bleed photographic beat with a caption pinned bottom. Lists are rows divided by a single hairline, with a date or meta column of about 8.5rem and a large headline column.

The back office is compact and mobile-first: 2.6rem controls, cards at 1.3rem padding, a sticky save bar, bottom navigation on phones, and bottom sheets for editors. Desktop navigation collapses to a Menu button at 1000px; the full-screen mobile menu numbers its items 01, 02, 03.

Breakpoints in use: 1000px (header collapses), 850px, 760px (container and type step down), 750px (form grids go single column).

## Elevation & Depth

Depth comes from tonal layering first: Stage Black, Booth Panel, Raised Panel, each with a hairline border. Shadows are reserved for things that float above the page, and for light, not for weight.

### Shadow Vocabulary
- **Violet Glow** (`box-shadow: 0 0 1.6rem rgba(109, 40, 217, .2)` plus a 1px violet ring at .2 alpha): hover state of the white pill button. Rest state is a barely-there .08 version.
- **Hairline Glow** (`box-shadow: 0 0 .7rem rgba(157, 92, 255, .34)`): the gradient rule under eyebrows and on the nav underline.
- **Floating Panel** (`box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, .55)`): menus, popovers, toasts, sheets.
- **Backdrop** (`rgba(4, 3, 7, .72)` with `blur(6px)`): behind modals and drawers. Header and floating bars use `blur(12px to 16px)` over a translucent near-black.

### Named Rules
**The Glow-Not-Shadow Rule.** On the dark surface, a shadow that is not black is light. Use violet glow to signal hover or emphasis, and black shadow only to separate floating layers from the page.

## Shapes

Two corner families, split by context. The public site speaks in pills (999px) for buttons and in generous 1 to 1.2rem corners for media and showreel frames. The back office uses rounded rectangles: .6 to .65rem for controls, .8rem for menus, 1 to 1.1rem for cards, 1.25rem for the top corners of bottom sheets. Tags, status chips and the header Menu button are pills in both.

Borders are always 1px hairlines in violet-tinted greys. Dashed borders mark empty states. Photographs are cropped by object-fit, slightly desaturated (saturate .9, contrast 1.04) and darkened from the bottom with a gradient so captions read. A decorative orbit of concentric 1px violet circles appears in empty states.

## Components

### Buttons
- **Public primary:** a white pill, 2.9rem tall, Archivo 800 at .9rem, -0.015em tracking, near-black text. Hover lifts 2px, border turns Lavender Mist, and the violet glow grows.
- **Public secondary:** the same pill in translucent near-black (`rgba(12,10,15,.48)`) with a #3c3741 border and backdrop blur. Hover warms the border to violet.
- **Admin button (`mh-btn`):** a 2.6rem rounded rectangle, #131118 fill, #2f2a37 border, .84rem at 600. Variants: `primary` (white fill, 700), `danger` (deep red fill, pink text), `ghost` (no border, muted text). Hover lightens border and fill by one step.
- **Icon button:** a 2.35rem square, same fill and border; `active` is a violet-tinted fill (#231a3d) with a #6d4bd1 border.
- **Focus:** a 2px lavender (#d9cfff) outline with 4px offset on every interactive element.

### Chips and Tags
- **Tag:** a small pill, #19161f fill, #2e2936 border, .72rem text. Removable tags brighten on hover.
- **Status chip:** a pill with a hairline border and a leading 7px dot in `currentColor`. Tones (info, success, warning, danger) tint the border and text only; the fill stays transparent.

### Cards and Containers
- **Corner Style:** 1rem (1.1rem for stat cards).
- **Background:** Booth Panel, with Raised Panel for nested items; nested editors sit on #0c0a0f.
- **Border:** 1px Hairline. No shadow at rest.
- **Internal Padding:** 1.3rem, with 1rem for nested items.
- **Empty state:** a dashed #332d3b border, a violet-grey icon, and a bold lead line.

### Inputs and Fields
- **Style:** #0f0d13 fill, #2f2a37 border, .6rem radius, .86rem text, placeholder in Dim Mist at full opacity.
- **Focus:** the border shifts to violet (#7a57de) with a 3px soft violet ring at .2 alpha.
- **Labels:** stacked above, .8rem at 600 in a pale violet-grey, with a smaller helper line below.

### Navigation
- **Public header:** fixed, translucent near-black gradient with a blurred backdrop and a hairline bottom. A three-column grid: wordmark logo with a faint violet drop-shadow, centered text links in grey, and a white pill Book button on the right. Active and hover links turn white and draw a violet-to-lavender underline.
- **Mobile menu:** full-screen, numbered rows (01, 02, 03) with display-size titles; the active row is Lavender Mist with a slight glow. The booking prompt sits at the bottom.
- **Back office:** a bottom navigation on phones with an active item lit by a soft violet shadow; bottom sheets with a 2.5rem drag handle.

### Showreel and Gallery (signature)
A framed 1.2rem block with a violet radial highlight, a sweeping diagonal sheen on hover, mono metadata along the top, and a large white circular play button beside an oversized headline. The gallery beneath alternates wide and narrow tiles, with a mono index at the bottom left and a caption that fades in on hover and focus.

## Do's and Don'ts

### Do:
- **Do** keep every surface in the violet-tinted dark ramp (#08080b to #17141c) and separate layers with a 1px hairline before reaching for a shadow.
- **Do** make the primary action a white pill (public) or a white rounded rectangle (back office), with near-black text (#09080b).
- **Do** set large type at weight 800, -0.04em, line-height 0.9 to 1; use `text-wrap: balance` on display titles.
- **Do** put event facts (date, venue, counts) in the mono stack with tabular numerals.
- **Do** end each eyebrow with the short violet gradient rule, and let it be the main place the accent shows up.
- **Do** keep text on dark surfaces at 4.5:1 or better, and keep the lavender focus outline on every control.
- **Do** honor `prefers-reduced-motion`: no lifts, sheens or smooth scroll.

### Don't:
- **Don't** add a light theme or a white page background.
- **Don't** fill large areas or buttons with violet; it is a light source, not a paint color.
- **Don't** introduce a second accent hue. Green, amber and red exist only for status.
- **Don't** use gradient text or colored side-stripe borders on cards.
- **Don't** use pill buttons inside dense back-office toolbars; they get the .65rem rounded rectangle.
- **Don't** set small text in the tight, heavy display style, or headlines in medium weight with loose tracking.
- **Don't** use stock-photo gloss: photography is real nights, slightly desaturated, darkened toward the caption edge.
