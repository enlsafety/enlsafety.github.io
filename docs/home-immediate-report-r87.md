# Home banner refinement r87

Final active order: golf welcome, immediate accident reporting, launch announcement, fire prevention, 2026 health check. The audited configuration migration removes the previous TBM/PPE/prevention slots, inserts immediate reporting after the first slot and preserves unrelated uploaded slots and metadata. Existing built-ins remain available for backward compatibility in the manager; no original files are deleted.

The golf slogan is left aligned in navy with a pale fade and white text shadow. Fire artwork and main wording are preserved, with a right-side pre-work checklist. Health wording is preserved and the original female doctor/worker consultation photo (`health-check-2026-r84.webp`) is restored. Its date sits on the calendar on desktop and in a small left badge on mobile.

The urgent banner states: 사고 발생 즉시, 먼저 보고하세요. 비용과 견적을 기다리지 마세요. 지금 사고 내용 등록 → 추후 비용과 견적 입력. It describes the existing cost-addition workflow; no reporting or approval policy changes were made.

Generated `assets/banners/report-now-r87.webp` from an original 2172×724 PNG without resizing. Prompt: ultrawide 3:1, no text/numbers/logos, blank warm ivory left 62%, right-third editorial dimensional paper illustration with navy smartphone, red alert symbol, report form, vermilion clock and safety helmet; coral/navy/cream palette. Original PNG retained in generation output; existing image assets retained in git.

Validation before publication:
- Actual dashboard scripts in browser fixtures at 1365px and 390px: 39 assertions each, including five-card order, image loading, text bounds, all non-home exits, home return, compact feeds, overflow and runtime errors. Desktop and mobile gallery screenshots visually inspected.
- Actual Edge handler with isolated PostgreSQL: 44 lifecycle checks, including reporting without a cost and adding an audited cost later without invalidating approval.
- Banner manager: 29 checks. New migration test covers order, removed slots, idempotence, audit, safety-only saving and preservation of uploaded slots.
- Release/cache checks passed. No production incident records or user permissions were modified. Production authenticated user sessions were not used for testing.
