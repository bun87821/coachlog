# Calendar Design QA

- Source visual truth: `/Users/bun/.codex/generated_images/019febc1-7aae-7e31-80d7-6a33f60d0018/exec-6160bc57-fb0e-4178-8091-eeaf99982792.png`
- Implementation screenshot: `/Users/bun/Documents/Codex/2026-08-10/ji3ul/outputs/calendar-v2-final-compact-mobile.png`
- Combined comparison: `/Users/bun/Documents/Codex/2026-08-10/ji3ul/outputs/calendar-design-qa-final.jpg`
- Viewport: 390 x 844 CSS px, device scale factor 1
- Source pixels: 853 x 1844, normalized to 390 x 844 for comparison
- Implementation pixels: 390 x 844
- State: signed-in dashboard, month view, 2026-08-10 selected

## Full-view comparison evidence

The final implementation follows the selected hierarchy: CoachLog header, month/week/day switch, compact availability month, selected-day summary, primary booking action, booked list, available slots, and calendar settings. The implementation uses live Google Calendar data and account settings, so names, appointment counts, and available-slot counts intentionally differ from the concept mock.

## Focused region evidence

The month grid and selected-day transition were inspected at original resolution. Availability uses text as well as color, the selected day's text remains legible on green, and the mobile page has no horizontal overflow (`innerWidth=390`, `scrollWidth=390`). Week and day controls were exercised, each reached `aria-pressed=true`, and the settings form opened successfully.

## Findings and comparison history

- Pass 1 P2: the selected day's availability label used green on green. Fixed with an explicit selected-state text override; verified in the revised screenshot.
- Pass 1 P2: the production calendar was too tall and pushed selected-day content below the first screen. Reduced mobile day-cell height and month-control spacing; the final comparison now exposes the selected-day heading and primary booking action in the first viewport.
- Pass 1 P2: server/browser time formatting produced hydration warnings. Standardized event date and time formatting to `Asia/Taipei`; no new hydration errors appeared after the revised deployment.
- P3: the concept uses illustrative avatars, while production intentionally omits them because CoachLog does not store student photos.

## Required fidelity surfaces

- Typography: existing CoachLog Arial/Noto Sans TC stack, weights, hierarchy, and wrapping remain consistent with the product and source direction.
- Spacing/layout: compact grid and first-screen hierarchy now closely match; production retains slightly larger touch targets.
- Colors/tokens: existing paper, forest-green, ink, line, orange warning, and gray full-state tokens match the concept.
- Images/assets: no required product image assets exist; concept avatars were intentionally excluded rather than replaced with fake imagery.
- Copy/content: Traditional Chinese labels and real calendar/student content are used throughout.

## Primary interactions tested

- Switch month to week and day views.
- Open calendar settings.
- Confirm responsive width and absence of horizontal page overflow.
- Confirm selected-day appointments and available time slots render from live data.

final result: passed
