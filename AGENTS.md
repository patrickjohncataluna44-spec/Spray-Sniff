# Project Agent Guidelines

## Frontend Design & House Style (`taste-skill`)

This project has installed **Taste Skill** (`design-taste-frontend`) located at `.agents/skills/design-taste-frontend`.

When building, modifying, or reviewing frontend interfaces, pages, or components:
1. **Adhere to the Anti-Slop House Rules**:
   - Reference: `.agents/skills/design-taste-frontend/SKILL.md`
   - Avoid generic AI defaults:
     - No resting element shadows (save shadows for active dropdowns / modals / popovers).
     - No purple/indigo gradient accents unless explicitly part of the defined brand.
     - No decorative hairline dividers where whitespace or tonal contrast suffices.
     - No tiny uppercase letter-spaced eyebrow labels above headings.
     - No emoji icons in place of actual SVG icons or clean typography.
     - No fake empty cards or generic 3-column feature grids.
2. **App Screens vs Public Pages**:
   - For **Admin & Dashboard views** (e.g. `/app/admin/*`, inventory, orders, settings): follow `.agents/skills/design-taste-frontend/references/app-screens.md`. Use high-density data presentation, clean borders (`data-ui`), and purposeful tools rather than marketing ornament.
   - For **Public Storefront pages** (e.g. `/app/page.tsx`, `/app/collections/*`, `/app/about/*`): use intentional typography, editorial compositions, and authentic imagery.
3. **Verification**:
   - Run `npm run taste:lint` to catch anti-patterns across modified pages.
   - Run `npm run taste:draw -- --sector ecommerce` when looking for fresh, deliberate art directions.

