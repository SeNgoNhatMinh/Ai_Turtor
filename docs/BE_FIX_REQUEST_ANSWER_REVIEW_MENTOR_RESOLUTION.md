# BE Fix Request: Resolve Mentor-Pending AI Answer Reviews

## Problem

The backend exposes the Teacher queue:

```http
GET /api/tutor/answer-reviews/mentor-pending?courseId={courseId}
```

but it does not expose a mutation that resolves an existing `NEEDS_MENTOR_REVIEW` record.

The previous FE called `POST /api/tutor/answer-reviews` again when a Teacher clicked an action. That creates a second review and leaves the original ticket in the pending queue after reload. FE no longer performs this incorrect mutation.

## Required Endpoint

```http
POST /api/tutor/answer-reviews/{reviewId}/mentor-resolve
Authorization: Bearer <TEACHER_JWT>
Content-Type: application/json
```

Suggested request:

```json
{
  "mentorReviewerId": "TEACHER_ID",
  "mentorReviewerName": "Teacher A",
  "reviewerRole": "TEACHER",
  "decision": "RESOLVE" ,
  "notes": "Checked against the course material.",
  "correctedAnswer": "Optional verified correction",
  "forwardToSenior": false
}
```

Suggested decisions:

- `CONFIRM_AI_ANSWER`: resolve without correction.
- `RESOLVE_WITH_CORRECTION`: save the verified correction and resolve.
- `FORWARD_TO_SENIOR`: move the same review to `NEEDS_SENIOR_REVIEW`.

## Required Behavior

1. Verify authenticated role is `TEACHER`, `SENIOR_MENTOR`, or `ADMIN`.
2. A Teacher may only resolve reviews for a course/class they manage.
3. Update the existing review instead of creating another `AiAnswerReview`.
4. Save reviewer identity, notes, corrected answer, decision, and reviewed time.
5. Set status to `RESOLVED`, or `NEEDS_SENIOR_REVIEW` when forwarded.
6. Do not index knowledge directly from this endpoint.
7. If a reusable academic correction should become AI knowledge, create a `KnowledgeCandidate` with `PENDING_SENIOR_REVIEW`; final indexing must still require Senior/Admin approval.

Suggested response:

```json
{
  "reviewId": "REVIEW_ID",
  "status": "RESOLVED",
  "mentorReviewDecision": "RESOLVE_WITH_CORRECTION",
  "linkedKnowledgeCandidateId": null,
  "updatedAt": "2026-07-16T10:00:00"
}
```

## FE State Until Endpoint Exists

- `NEEDS_MENTOR_REVIEW` is displayed with complete evidence.
- Teacher mutation buttons are intentionally disabled/removed to prevent duplicate reviews.
- Senior/Admin processing remains available through `/senior-resolve` and KnowledgeCandidate approve/reject APIs.
