# Documentation Index

This folder contains maintenance-oriented documents for the scroll-driven product detail page.

- `SCROLL_FLOW_ARCHITECTURE.md`
  - runtime architecture (`outerY` + `groupY`)
  - gesture state machine (`start` / `move` / `end`)
  - overlay progress and entrance animation logic
  - full `productConfig.js` parameter reference
  - tuning and troubleshooting checklist

Recommended onboarding order:

1. Read `SCROLL_FLOW_ARCHITECTURE.md` sections 1-4 to understand runtime behavior.
2. Read section 5 before editing `data/productConfig.js`.
3. Use section 6-7 when tuning gesture feel or debugging regressions.

