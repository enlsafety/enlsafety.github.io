# Current app icon: r53 sky-blue E&L rounded square

`assets/enl-app-icon-r53.png` is the supplied master: a sky-blue gradient tile with white E&L lettering outlined in navy. The icon build strips the exterior white margin during packaging. Earlier masters are kept for history, not used at runtime.

- Login, integrated-home and module/system title marks use `pwa-icon-512.png?v=4813-r53`.
- Desktop/Android any-purpose PNGs, small browser favicons and multi-size Windows ICO are rebuilt from the same master.
- iOS/iPadOS 180px and its root fallback are opaque sky-blue derivatives.
- The adaptive 512px icon fits the full mark inside the standard 40% safe-circle radius.
- HTML, manifest and service-worker icon cache keys are refreshed. App identity, authentication, workflows and records stay unchanged.
- Existing installed OS icons may update later than the website. Physical-device installation refresh is not exercised by the cloud-browser checks.

The branding requirement is recorded in AGENTS.md. The separate E&L corporate wordmark remains unchanged.

## Earlier releases (historical)

# App icon release r47

The approved E&L blue shield and green golf fairway mark replaces the previous generic app icon. The proposal board was separated with imagegen into `assets/enl-app-icon-r47.png`; original uploaded artwork is preserved. Runtime icon sizes are downsampled from this master without changing its internal design.

- Browser: 16px/32px PNG plus multi-size ICO fallback.
- Desktop/Android installation: transparent 192px/512px PNG.
- iOS/iPadOS: opaque pale-blue 180px apple-touch-icon; matching root fallback.
- Adaptive Android icon: separate opaque 512px asset with the entire shield inside the 40% radius safe circle.
- Legacy icon paths remain available, and manifest/HTML icon URLs carry r47 cache keys. The service-worker cache is refreshed.

Manifest identity, scope, start URL, authentication, permissions and operational data are unchanged. Existing OS-installed icons may update on the operating system/browser's schedule; deployment does not force an instant replacement of an already-installed OS shortcut. Native iOS/Android/Windows installation was not exercised in the cloud browser.

Verification: icon formats/dimensions and alpha inspected; adaptive artwork checked inside the safe circle; release/cache test passed. References: https://web.dev/articles/maskable-icon and https://webkit.org/blog/13878/.

## r48 desktop visible-size adjustment

Repack the unchanged r47 source into a tighter transparent canvas, retaining a four-source-pixel gutter around the visible alpha bounds and a one-output-pixel guard (two at 256/512). This maximizes the shield inside the fixed OS icon slot without stretching or cropping the visible artwork. Desktop/any-purpose 192/512 PNGs, 16/32 favicons and ICO frames at 16/20/24/32/40/48/64/128/192/256 are rebuilt directly from the original source. iOS and adaptive maskable bitmap files remain unchanged. `scripts/build-desktop-icons.cjs` validates a fully transparent outer edge for every generated size. OS taskbar slot dimensions themselves are controlled by Windows; this release increases artwork coverage inside each slot.

## r49 unified system title mark

Login, integrated-home and module/system headers now reuse the same transparent app icon (`pwa-icon-512.png?v=4813-r48`). The integrated-home renderer no longer replaces the shared header image with a cross shield or restores a different mark on navigation. Mobile header displays the same mark with its existing compact title layout. The separate corporate E&L wordmark is preserved. This standard is recorded in AGENTS.md for future screen changes.
