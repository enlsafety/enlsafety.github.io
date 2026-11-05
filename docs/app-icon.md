# App icon release r47

The approved E&L blue shield and green golf fairway mark replaces the previous generic app icon. The proposal board was separated with imagegen into `assets/enl-app-icon-r47.png`; original uploaded artwork is preserved. Runtime icon sizes are downsampled from this master without changing its internal design.

- Browser: 16px/32px PNG plus multi-size ICO fallback.
- Desktop/Android installation: transparent 192px/512px PNG.
- iOS/iPadOS: opaque pale-blue 180px apple-touch-icon; matching root fallback.
- Adaptive Android icon: separate opaque 512px asset with the entire shield inside the 40% radius safe circle.
- Legacy icon paths remain available, and manifest/HTML icon URLs carry r47 cache keys. The service-worker cache is refreshed.

Manifest identity, scope, start URL, authentication, permissions and operational data are unchanged. Existing OS-installed icons may update on the operating system/browser's schedule; deployment does not force an instant replacement of an already-installed OS shortcut. Native iOS/Android/Windows installation was not exercised in the cloud browser.

Verification: icon formats/dimensions and alpha inspected; adaptive artwork checked inside the safe circle; release/cache test passed. References: https://web.dev/articles/maskable-icon and https://webkit.org/blog/13878/.
