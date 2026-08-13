# AI Tutor Frontend Architecture Guide

## Goal

Keep the frontend easy to read, safe to change, and scalable as backend flows grow.

The current runtime is route-based and feature-owned:

```text
src/main.jsx -> src/app/AppProviders.jsx -> src/app/AppRouter.jsx
             -> role workspace -> feature route page
```

`src/App.jsx` is the authenticated composition shell. Business UI and state belong to the owning feature, not to `App.jsx` or a generic `pages` folder.

## Folder Rules

```text
src/components/common       Shared UI primitives used by many roles
src/components/markdown     AI answer rendering components
src/app                     Providers, router, layouts, role workspaces
src/config                  Runtime configuration
src/constants               Cross-feature enums, labels, options, copy maps
src/features/auth           Login and persisted auth session
src/features/student        Student route pages, controllers, views
src/features/teacher        Teacher route pages, controllers, views
src/features/senior         Senior-only route pages
src/features/admin          Admin route pages, controllers, views
src/features/quality-review Shared Senior/Admin review domain UI
src/features/expert-training Shared Tutor V2 domain UI and data access
src/hooks                   Cross-feature application hooks
src/services                API layer and normalizers
src/utils                   Pure utilities, permissions, formatting, validation
```

`src/pages` is intentionally removed. Do not recreate role portals or duplicate route views outside `src/features/*`.

## Component Splitting Rules

Split a component when it has one of these smells:

- More than one business workflow in one file.
- Repeated enum/status labels.
- Repeated button/action groups.
- Inline option lists that backend also depends on.
- Large JSX blocks that do not need parent state.

Prefer:

```text
FeaturePage.jsx           composes focused controllers for one route
FeatureView.jsx           owns one screen without endpoint construction
SmallPanel.jsx            renders one visual block
constants/*.js            owns backend-aligned options/status labels
utils/*.js                owns pure permission/format/validation logic
```

## Current Backend Learning Flow Files

Student answer review:

```text
src/constants/answerReview.js
src/features/student/chat/components/AnswerFeedbackControls.jsx
src/features/student/chat/components/ChatWorkspace.jsx
```

Teacher support and AI learning:

```text
src/constants/knowledgeFlow.js
src/utils/permissions.js
src/features/teacher/review/TeacherAnswerModeSelector.jsx
src/features/teacher/review/KnowledgeCandidateReviewList.jsx
src/features/teacher/review/TeacherSupportInbox.jsx
```

## API Rules

- UI components should not build endpoint paths.
- API calls go through focused domain files in `src/services/`; UI components never build endpoint paths.
- If backend returns multiple response shapes, normalize in `src/services/normalizers.js`.
- Keep backend enums unchanged in payloads.
- UI labels can be friendly, but payload values must stay backend-aligned.

## Permission Rules

- Permission checks belong in `src/utils/permissions.js`.
- UI can hide/disable buttons, but backend remains the source of truth.
- Preserve original backend role when normalizing app role for routing.

## Refactor Checklist

1. Extract constants/helpers first.
2. Extract pure child component.
3. Replace JSX in parent with the child component.
4. Run `npm run build`.
5. Search for stale imports with `rg "src/pages|pages/" src tests`.
6. Update `docs/FE_UPDATE_LOG.md`.

## Do Not Do In A Routine Refactor

- Do not move `main.jsx` or replace the app shell without a dedicated phase.
- Do not introduce a new dependency unless the task needs it.
- Do not change endpoint paths while splitting files.
- Do not add compatibility facades unless an external import contract requires one.
