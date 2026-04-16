# Scroll Flow Architecture and Config Reference

## 1. Runtime model

This page uses two coordinated tracks:

- `outerY`: cross-group track offset (which group screen is visible).
- `groupY[gidx]`: inner scroll offset for a specific group.

At any frame, final image top position is computed by:

```text
imgTop = outerY + gidx * windowHeight + groupY[gidx] + imgIndex * windowHeight
progress = clamp(1 - imgTop / windowHeight, 0, 1)
```

The `progress` value drives all overlay animations.

## 2. Gesture pipeline

### 2.1 Start

`onGStart` stores:

- touch baseline (`_touchStartY`)
- inner baseline (`_touchStartGroupY`)
- outer baseline (`_touchStartOuterY`)
- current between-page state (`_flowPanState`)

### 2.2 Move

Two branches:

1. `flow-pan` branch (`_flowPanState` exists): drag continues from current `outerY`.
2. normal branch: compute overscroll by `_getOverscrollMeta`.

`_getOverscrollMeta` returns:

- `groupY` to apply
- `outerY` to apply
- `progress` in threshold range
- `direction` (`next` / `prev` / `null`)

### 2.3 End

1. If in `flow-pan`: settle by `_finishFlowPan` -> `_settleFlowPan`.
2. Else if overscroll exists: decide switch by threshold/velocity.
3. Else: run inner fling (`_startFlingAnimation`).

## 3. Overlay animation system

### 3.1 Config normalization

During load, each overlay is normalized:

- `pos` -> percent anchor (`_anchorStyle`)
- `anim` defaults (`startPos`, `endPos`, `from`, `to`, opacity/scale)
- runtime style holder (`_dynamicStyle`)

### 3.2 Progress mapping

For each overlay:

```text
t = 0                      if progress <= startPos
t = 1                      if progress >= endPos
t = (progress-startPos)/(endPos-startPos) otherwise
```

Then interpolate transform/opacity:

- translate: `from -> to`
- scale: `fromScale -> toScale`
- opacity: `fromOpacity -> toOpacity`

### 3.3 Initial entrance policy

Each group entrance animation runs once:

- `_enteredGroups[gidx]` is false initially.
- `_ensureGroupEntrance` triggers `_playInitialEntrance` when group center is near viewport.
- after first run, the group is marked entered and will not replay.

## 4. Why visible-group update is required

In flow transitions, two groups can be visible at the same time.
If only one group updates overlays, the other side appears delayed or frozen.

`_updateVisibleAnimations` solves this by updating:

- floor page group
- ceil page group
- current dominant group

at each frame where `outerY` changes.

## 5. productConfig.js reference

Path: `data/productConfig.js`

## 5.1 groupTransition (global)

- `mode`: `'snap' | 'flow'`
  - `snap`: page-like switch after threshold/velocity.
  - `flow`: continuous outer track drag after boundary break.
- `threshold` (number, px): overflow distance threshold to trigger switch.
- `velocityThreshold` (number, px/ms): flick velocity threshold.
- `resistance` (number): damping factor for overscroll.
- `flowStart` (number): compatibility field kept for future tuning.

Recommended starting ranges:

- `threshold`: `80 ~ 140`
- `velocityThreshold`: `0.35 ~ 0.65`
- `resistance`: `0.20 ~ 0.35`

## 5.2 groups[]

Each group is a full-screen track, with independent inner scroll (`groupY[gidx]`).

## 5.3 images[]

Each image is treated as one viewport-height segment in scroll progress math.

Required:

- `id`
- `src`
- `overlays`

## 5.4 overlays[]

- `type`: `tag | card | main` (visual template)
- `pos`: final anchor position in image space
  - `<= 1`: treated as ratio (`0.5` -> `50%`)
  - `> 1`: treated as direct percent
- `anim`: animation definition
- `style`: visual style fields

### anim fields

- `type`: `fade | slideX_left | slideX_right | slideY | zoom`
- `startPos`, `endPos`: active progress range in `[0,1]`
- `from`, `to`: `{x, y, unit}` motion endpoints
- `fromOpacity`, `toOpacity`
- `fromScale`, `toScale`
- optional entrance timing:
  - `duration` (ms)
  - `delay` (ms)
  - `easing` (`spring | ease | linear | easeIn | easeOut | easeInOut`)

### style fields

- `color`, `fontSize`, `fontWeight`
- `bgColor`, `bgBlur`, `boxShadow`

## 6. Tuning playbook

If switch is too hard:

- decrease `threshold`
- or decrease `velocityThreshold`

If movement is too bouncy:

- increase `resistance` slightly

If overlays appear too late:

- reduce `startPos`
- reduce `endPos` or move `from` closer to `to`

If entrance appears too slow:

- reduce `duration` and/or `delay`

## 7. Troubleshooting checklist

1. Overlay missing until very late:
   - verify visible-group updates are active (`_updateVisibleAnimations`).
2. Group content disappears after back switch:
   - ensure target group `groupY` is not forcibly reset on switch.
3. Tip bar shows after threshold break:
   - ensure spring tip only shows when `0 < progress < 1`.
4. Flow continuation jumps on second drag:
   - ensure `_touchStartOuterY` is captured and `_flowPanState` branch is used.

