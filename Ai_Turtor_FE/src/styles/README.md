# CSS Ownership

`src/index.css` is the only global CSS entry. It imports modules in cascade order,
so imports must not be reordered without desktop, mobile, light-mode, and dark-mode
verification.

## Global styles

- `tokens.css`: application color, spacing, radius, and typography tokens.
- `base.css`: reset, document defaults, global scrollbars, and route loading.
- `theme.css`: global light/dark surface overrides.
- `animations.css`: shared keyframes and loading animation helpers.
- `application-responsive.css`: cross-feature responsive rules that cannot yet be
  owned by one route.
- `antd-overrides.css`: global Ant Design compatibility rules only.
- `accessibility.css`: focus-visible, reduced-motion, modal, and table safeguards.

## Ownership rules

- App header, sidebar, and authenticated layout styles belong in `src/app/layouts`.
- Reusable component styles belong beside the component under `src/components`.
- Ant Design is the single runtime UI system; do not add a parallel utility/component stack for one feature.
- Student, Teacher, Admin, and Expert Training styles belong in their matching
  `src/features` directory.
- Responsive rules for one feature stay in that feature. Only truly shared viewport
  rules belong in `application-responsive.css`.
- Ant Design overrides must be scoped to a page or feature whenever possible.
- Do not add generic selectors such as `.title`, `.card`, or `.content` to a feature.
- Do not move feature CSS back into `src/index.css`; add an import at the correct
  cascade position instead.

## FPT UI contract

- `src/theme/fptTheme.js` is the Ant Design source of truth. `tokens.css` mirrors
  its semantic values for feature-owned CSS.
- Use `--color-action-primary` for primary actions and selected controls,
  `--color-navigation` for navigation, `--color-success` for completion,
  `--color-error` for failures and destructive actions, and
  `--color-surface-subtle` for table or administration backgrounds.
- Use the shared `PageHeader`, `ActionButton`, `DataTable`, `SearchableTable`, and
  `AsyncState` components before creating a feature-specific equivalent.
- Keep at most 100 records in a server page. Paginate material, enrollment, and
  assignment APIs before adding client virtualization. Chat history already
  reveals sessions in batches of 50 and tutor sessions are capped at 10 turns.
- Every clickable row must support `Enter` and `Space`, every icon-only action
  needs an accessible label, and new layouts must remain usable at 768px and
  below.

## Safe migration

1. Move one complete selector block without changing its declarations.
2. Keep base rules before theme, dark-mode, and responsive overrides.
3. Search the selector with `rg` before deleting its previous definition.
4. Run `npm run check` and the Playwright desktop/mobile suite.
5. Compare light and dark screenshots before changing import order.
