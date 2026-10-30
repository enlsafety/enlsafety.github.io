# Action form and approval layout (4.8.6)

- Constrain both action date inputs and their grid cells, including WebKit native date sizing, to the mobile form width.
- Use explicit dismissible validation for the D action form. Future dates and completion-before-start are rejected before requests, including draft saves. Required fields and server-side validation remain enforced. The form no longer creates native validation balloons that can linger after navigation.
- Fit full photos in cumulative report previews, including the safety manager's D evidence review. Increase the preview area without changing stored photos or attachment opening behavior.
- Display a shared horizontal approval sheet above the report and at the top of the final PDF. Group the field/safety columns, the four executive columns, and the final president column with small gaps. Mobile overflow is confined to the sheet.
- Order current executive slots as 이영균, 이재민, 김동석, 박종태, followed by 이실연 at the far right. Existing approval records retain their roster snapshot; no historical signatures or times are rewritten.
- Field drafting time comes from `corrective.submittedAt`, with the actual `submittedBy`. Safety approval comes from `corrective.reviewedAt` for that submission. Each executive uses their recorded signature time. Display times use Korea time.
- Replace the requested workflow term in generated app, email, and push text with ordinary approval wording. Internal stage values and the existing all-executives-before-president rule remain unchanged.

Validation uses synthetic records and mock notification providers. Test the real form through the authenticated Edge handler in isolated PostgreSQL; check invalid-date dismissal, successful correction/submission, scoped image geometry, requested order, timestamp sources, immutable roster use, mobile overflow and final PDF placement. Chromium desktop/mobile and WebKit mobile are included in cloud QA, alongside the existing full regression/staging suites. Inspect rendered screenshots and the PDF, then verify public production source bytes after publication.

Release backend changes: wording-only migration `20261030081958_approval_notification_wording.sql` and email Edge function. No account, incident, signature, preference or existing notification rows are changed by this release.
