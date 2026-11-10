# AGENTS.md (apps/web)

## Design language

All design changes to the storefront and admin must follow Apple's Liquid Glass design language. Apply this to every new component, restyle, and animation unless the owner says otherwise.

- **Material**: floating controls, bars, menus, and panels use the shared `.glass` class in `src/app/globals.css` (translucent tint, `backdrop-filter: blur(20px) saturate(190%)`, light top edge, soft drop shadow). Tune a surface with the `--glass-tint`, `--glass-sheen`, `--glass-edge`, `--glass-shade`, and `--glass-drop` variables rather than writing a new material.
- **Shape**: capsules (`border-radius: 999px`) for bars, fields, and buttons. Use continuous rounded rectangles of about `1.25rem` or more for panels, and the superellipse `.app-icon` mask for the logo.
- **Hierarchy**: glass floats above the content and never sits on top of other glass. Content stays legible. Raise `--glass-tint` opacity on panels that hold text.
- **Motion**: use spring curves such as `cubic-bezier(0.32, 1.25, 0.55, 1)`, not linear or plain ease. Elements morph out of their source, for example the nav search expanding out of its button across the nav bar, and never cross other controls on the way. Neighbouring glass makes room as they move. Landings get a small squash-and-settle.
- **Press feedback**: tappable elements recess on press. They scale to about 0.94 to 0.95 using `--press-in` and spring back with `--press-out`.
- **Focus states**: when a search or sheet opens, dim and blur the content behind it, as `.nav-search-backdrop` does.
- **Accessibility**: respect `prefers-reduced-motion` (handled globally), `prefers-reduced-transparency` (drop the backdrop blur and use a solid tint), dark mode via `prefers-color-scheme`, and browsers without `backdrop-filter`.
