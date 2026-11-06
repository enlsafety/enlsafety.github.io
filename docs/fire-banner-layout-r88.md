# Fire banner readability r88

Only the fourth home banner's text composition changes. The original `assets/banners/fire-r86.webp` is byte-for-byte unchanged. The image uses a centered cover crop so its clear right half remains available at desktop and narrow mobile aspect ratios.

Replace the two competing text columns, duplicated instructions and translucent patches with one right-side block: a small Korean category label, two-line headline in dark green and burnt orange, followed by three numbered checks. Text begins at 55% of the banner on desktop and 52% on mobile, beyond the illustration boundary. Remove superseded fire CSS rather than retaining layered overrides.

Validation: actual dashboard browser fixtures at 1365px and 390px passed 42 assertions each (banner order, images, text and list bounds, menu navigation, compact feeds, overflow, runtime errors). Visually inspected the unchanged image and right-side copy at 900px, 390px and 320px. JavaScript syntax and release/cache checks passed. No backend, stored banner settings, incident data, workflow or permission changes.
