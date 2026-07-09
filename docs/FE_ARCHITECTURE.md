# AI Tutor Frontend Architecture Guide

## Goal

Keep the frontend easy to read, safe to change, and scalable as backend flows grow.

The current runtime remains:

```text
src/main.jsx -> src/App.jsx -> role portals -> tab components
```

Do not move large portal files in one commit. Split by stable business boundaries first.

## Folder Rules

```text
src/components/common       Shared UI primitives used by many roles
src/components/markdown     AI answer rendering components
src/config                  Runtime configuration and navigation config
src/constants               Cross-feature enums, labels, options, copy maps
src/hooks                   App-level hooks used by current runtime
src/pages/student           Student portal tab components
src/pages/teacher           Teacher portal tab components
src/pages/admin             Admin portal tab components
src/services                API layer and normalizers
src/utils                   Pure utilities, permissions, formatting, validation
```

`src/features/*` is reserved for a later architecture phase. Do not wire it into runtime unless dependencies and imports are verified.

## Component Splitting Rules

Split a component when it has one of these smells:

- More than one business workflow in one file.
- Repeated enum/status labels.
- Repeated button/action groups.
- Inline option lists that backend also depends on.
- Large JSX blocks that do not need parent state.

Prefer:

```text
ParentPortal.jsx          owns state and API orchestration
TabComponent.jsx          owns one screen/tab
SmallPanel.jsx            renders one visual block
constants/*.js            owns backend-aligned options/status labels
utils/*.js                owns pure permission/format/validation logic
```

## Current Backend Learning Flow Files

Student answer review:

```text
src/constants/answerReview.js
src/pages/student/AnswerFeedbackControls.jsx
src/pages/student/ChatWorkspace.jsx
```

Teacher support and AI learning:

```text
src/constants/knowledgeFlow.js
src/utils/permissions.js
src/pages/teacher/TeacherAnswerModeSelector.jsx
src/pages/teacher/KnowledgeCandidateReviewList.jsx
src/pages/teacher/TeacherSupportQueueTab.jsx
```

## API Rules

- UI components should not build endpoint paths.
- API calls go through `src/services/api.js` or domain service files.
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
5. Update `docs/FE_UPDATE_LOG.md`.

## Do Not Do In A Routine Refactor

- Do not move `main.jsx` or replace `App.jsx` runtime without a dedicated phase.
- Do not introduce a new dependency unless the task needs it.
- Do not change endpoint paths while splitting files.
- Do not delete legacy files just because they are hidden from navigation.
