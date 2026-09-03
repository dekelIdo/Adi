# Adi Social — Correct the failed mobile visual installation

The current implementation is visibly wrong and must be REPLACED, not patched on top.

Use only these optimized assets:

- `assets/studio-softbox-light-mobile.webp` — 384×576, transparent, ~42KB
- `assets/creative-lens-portal-mobile.webp` — 640×960, transparent, ~46KB

Together they are roughly 88KB. Remove all references to the previous 1.7MB PNG versions from the template, SCSS and build output references.

## What is wrong in the current result

The supplied failure screenshot shows four concrete defects:

1. The softbox is far too large and is cropped at the right edge like a broken object. A disconnected stand fragment is visible lower down.
2. The Lens Portal was inserted as a full-width image in normal document flow. Its 2:3 aspect ratio therefore creates an enormous white screen between the portrait and `איך הגעתי לתחום הזה?`.
3. The camera dominates the page and pushes the next heading far below the intended section rhythm.
4. The previous PNG assets total roughly 3.4MB and are unnecessarily expensive to download and decode on mobile.

Do not preserve this placement. Remove the failed wrappers/classes/rules that were added for it, while preserving every pre-existing section element.

## Scope lock

- This correction is only for the mobile composition, 320–430px.
- Hide these two assets completely at 768px and above.
- Do not touch tablet or desktop styling.
- Do not change the existing portrait crop, section copy, typography, dock, header, carousels, FAQ, global spacing tokens or reveal system.
- Do not add new content or regenerate the supplied assets.
- Do not use global overflow hiding.

## Correct composition

Both assets belong to the portrait/story section, but they serve different roles.

### A. Softbox: a small side light, not a second hero

Anchor the softbox absolutely to the existing portrait media wrapper.

Starting calibration for 390px viewport:

```scss
width: clamp(138px, 40vw, 172px);
inset-inline-end: clamp(-72px, -16vw, -48px);
top: clamp(74px, 23vw, 112px);
```

These are starting values to calibrate against the real DOM, not permission to create per-device patches.

Required visual result:

- Only a restrained portion of the lamp body may enter from the right edge.
- The lamp head should read at approximately 44–58 CSS pixels wide, not 120+ pixels.
- Its beam should touch Adi's right shoulder/portrait edge softly; it must not fog her face or erase contrast across half the image.
- The stand must remain connected to the lamp. No detached black leg or fragment may appear below the portrait.
- If local clipping is necessary, clip the entire softbox layer inside one deliberately sized overlay window; never crop the head and stand independently.
- Use `position: absolute`, `pointer-events: none`, `user-select: none`, `aria-hidden="true"`, empty `alt` and `draggable="false"`.
- Keep the asset out of normal flow so it adds zero height to the portrait.

Suggested stacking:

- portrait: base layer;
- beam/softbox: decorative layer above portrait;
- all real text, buttons and the fixed social dock: above decorative artwork.

### B. Lens Portal: compact transition, never a full-width block

Create one local transition wrapper immediately after the portrait and before the story heading. The wrapper reserves only the compact space intentionally used by the artwork.

Starting calibration:

```scss
.creative-lens-transition {
  position: relative;
  block-size: clamp(350px, 96vw, 410px);
  margin-block-start: clamp(-26px, -6vw, -14px);
  margin-block-end: clamp(-54px, -11vw, -34px);
}

.creative-lens-transition__art {
  position: absolute;
  width: clamp(270px, 76vw, 310px);
  max-width: none;
  inset-inline-end: clamp(-28px, -5vw, -12px);
  inset-block-start: 0;
  height: auto;
}
```

Calibrate these values as one fluid composition after inspecting the live section. Do not set `width: 100%`, `100vw`, an intrinsic full-width `<img>`, or a block height derived from the PNG/WebP aspect ratio.

Required visual result:

- Adi's cutout begins shortly below/overlapping the portrait's lower boundary, visually connecting both appearances of her.
- The optical line guides the eye downward.
- The camera enters from the lower-right but remains secondary; target roughly 120–155 CSS pixels across for the visible camera/lens body.
- The next heading should begin approximately 24–48px after the visible artwork, not after an empty screen.
- The entire portrait-to-story transition should feel like one compact editorial beat, not a separate section.
- The artwork may bleed slightly toward the right edge, but the section must contain horizontal overflow locally.
- Do not place the asset inside a card or add a background color behind it.

## Loading and rendering performance

- Copy the two supplied WebP files into the project's existing local media/brand asset directory.
- Remove the old PNG imports/references; do not ship both formats.
- Add intrinsic `width` and `height` attributes matching the files (`384×576` and `640×960`) so the browser knows aspect ratios.
- Because this section is below the initial hero, use `loading="lazy"`, `decoding="async"` and `fetchpriority="low"` on both decorative images unless inspection proves it is initially above the fold.
- Do not preload either decorative asset.
- Do not inline them as Base64.
- Do not use CSS background images for them; keep explicit `<img>` elements so loading behavior is controllable.
- Keep the reserved transition wrapper height stable so image arrival produces zero CLS.
- Do not add JS image-load listeners, timers, skeletons or spinners.

## Motion

- Reuse the existing reveal system only.
- Lens Portal entrance: maximum `translateY(10px)` plus opacity; no continuous floating camera.
- Softbox glow: either static or an extremely subtle 5–7 second opacity breath with no more than 6% variation.
- Under `prefers-reduced-motion: reduce`, disable looping/transform motion and show both immediately.

## Required verification

Test the real page at 320, 360, 375, 390, 393 and 430px, including slow scroll, fast scroll and reload while positioned near this section.

Acceptance criteria:

- No detached softbox/stand fragments.
- Softbox no longer dominates or covers Adi's face.
- No full-screen white gap between portrait and story heading.
- Camera is secondary and does not push the heading excessively downward.
- The story heading and first paragraph remain unobscured by artwork and the fixed social dock during normal scrolling.
- No horizontal overflow.
- No layout shift when either WebP finishes decoding.
- Both optimized files load successfully; old PNGs are unused.
- Confirm transferred asset weight is approximately 88KB total, excluding HTTP compression overhead.
- No visual or layout change at 768, 1024 or 1440px.
- Run `npm run build` and report the real result.
- If the project has no unit-test setup, say so instead of claiming tests passed.

After this correction, stop. Report:

1. old markup/classes/rules removed;
2. final selectors and calibrated placement values;
3. final rendered height of the transition at 390px;
4. network sizes and loading attributes;
5. viewport/overflow/CLS verification;
6. build result.

Do not make unrelated polish changes.
