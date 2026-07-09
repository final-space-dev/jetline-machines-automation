# Jetline UI

A shadow-driven component framework. No hard lines — separation comes from
elevation, soft fills, and tinted states. One confident red, generous radii,
lift-on-hover throughout.

## What's inside

```
jetline-ui/
├── ui/
│   ├── tokens.css      ← design tokens (colors, type, spacing, shadows, motion)
│   ├── controls.css    ← buttons, toggles, checkbox/radio, inputs, select, slider, search
│   ├── surfaces.css    ← cards, tiles, KPIs, badges, status, avatars, alerts, tooltips, progress
│   ├── overlays.css    ← tabs, dropdowns, accordion, table, steps/wizard, modal, toast, pagination
│   └── jetline.js      ← zero-dependency behavior (auto-wires via data-jl-* attributes)
├── Jetline UI Kit.html ← live showcase + documentation of every component
└── README.md
```

## Quick start

Drop the four stylesheets (tokens first) and the script into any page:

```html
<link rel="stylesheet" href="ui/tokens.css" />
<link rel="stylesheet" href="ui/controls.css" />
<link rel="stylesheet" href="ui/surfaces.css" />
<link rel="stylesheet" href="ui/overlays.css" />
<!-- … your markup … -->
<script src="ui/jetline.js"></script>
```

`tokens.css` **must** load first — everything else reads its `--*` variables.
You can omit any of `controls/surfaces/overlays` you don't need.

## Using components

Every class is prefixed `jl-`. Copy the markup straight from
**Jetline UI Kit.html** — it's the source of truth for every component.

```html
<button class="jl-btn jl-btn--primary">Create shipment</button>

<div class="jl-field">
  <label>Recipient</label>
  <input class="jl-input" placeholder="Jane Doe" />
</div>

<span class="jl-badge jl-badge--green">Delivered</span>
```

## Interactive components (JavaScript)

`jetline.js` auto-initializes on load — no setup. Wire behavior with data attributes:

| Pattern   | Markup hook |
|-----------|-------------|
| Tabs      | `[data-jl-tabs]` wrapping `.jl-tabs button[data-tab]` + `.jl-tabpanel[data-tab]` |
| Dropdown  | `.jl-dropdown` with `[data-jl-toggle]` + `.jl-menu` |
| Accordion | `[data-jl-accordion]` (add `data-single` for one-open) wrapping `.jl-acc` |
| Modal     | `[data-jl-open="id"]` opens `.jl-overlay#id`; `[data-jl-close]` closes |
| Wizard    | `[data-jl-wizard]` with `.jl-steps .jl-step` + `[data-jl-next]`/`[data-jl-prev]` |
| Slider    | `.jl-range` (fills automatically; add `[data-jl-output]` sibling for read-out) |

Imperative API:

```js
Jetline.toast('Shipment created', 'green');  // 'green' | 'red' | 'info'
Jetline.openModal('demoModal');
Jetline.closeModal('demoModal');
Jetline.init(container);  // re-scan after injecting markup dynamically
```

## Theming

All design decisions live in `tokens.css`. To re-skin the whole system,
change the variables — e.g. swap the brand:

```css
:root {
  --red-500: #e6121f;  /* primary brand */
  --red-600: #c40d17;
  --canvas:  #f4f6f9;  /* page background */
}
```

## Principles

- **No lines.** Use shadow (`--sh-*`), soft fills (`--ink-50`), and tints for separation.
- **Elevation = hierarchy.** `--sh-sm` resting, `--sh-md` cards, `--sh-lg` hover, `--sh-xl` modals, `--sh-red` for primary.
- **One red.** Saturated red is reserved for primary actions and active states; everything else is tint or neutral.
- **Lift on hover.** Interactive surfaces translate up; never rely on borders to signal interactivity.

---
Jetline UI v1.0
