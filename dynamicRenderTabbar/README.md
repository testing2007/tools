# dynamicRenderTabbar

Goal: verify a WeChat Mini Program can pre-register 5 real tab pages while rendering only N tab buttons at runtime.

## What this demo proves
- `app.json` keeps 5 real pages in `tabBar.list`.
- Custom tabbar (`custom-tab-bar`) renders only `N` items (`N` must be 3 or 4).
- Runtime value is read from storage key `visibleTabCount`.

## Run
1. Open WeChat DevTools.
2. Import this folder: `d:/workspace/tools/dynamicRenderTabbar`.
3. Launch and open Home page.
4. Tap `Set N = 3` or `Set N = 4` and observe tab button count changes.

## Key files
- `app.json`: 5 prebuilt real tab pages
- `custom-tab-bar/index.js`: runtime slice render logic
- `pages/home/index.js`: switches runtime N
- `utils/runtime-config.js`: runtime config read/write
