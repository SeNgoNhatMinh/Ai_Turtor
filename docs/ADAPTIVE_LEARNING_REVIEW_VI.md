# Adaptive Learning Review

## Behavior

- A review cycle is generated asynchronously after every 10 completed tutor sessions for a student and course.
- The evaluator receives excerpts from student/assistant messages in those 10 sessions and produces structured estimates: overall understanding, knowledge, practice, independence, strengths, gaps, and teaching recommendations.
- Evidence completeness is calculated from stored student-response coverage; it is not the LLM's self-reported confidence.
- When evidence completeness is at least 75%, the recommended level may be applied to subsequent sessions if no active teacher directive overrides it.
- Low-evidence or failed evaluations preserve the current level and are still placed in the teacher review queue for transparency.
- The assigned teacher receives an ADAPTIVE_LEARNING_REVIEW_CREATED realtime event and can inspect the stored evidence logs.
- APPROVE and MODIFY create and confirm a teacher-owned PedagogicalDirective; REJECT does not create a directive.
- Explicit teacher directives take precedence over adaptive recommendations.

## Teacher API

- GET /api/teacher/ai-support/learning-reviews?courseId={courseId}&classId={classId}
- GET /api/teacher/ai-support/learning-reviews/{reviewId}
- POST /api/teacher/ai-support/learning-reviews/{reviewId}/decision

Decision payload:

```json
{
  "decision": "APPROVE",
  "teacherFeedback": "Giải thích DTO và DAO bằng ví dụ thực tế.",
  "supportLevel": "HIGH_SUPPORT"
}
```

Allowed decisions: APPROVE, MODIFY, REJECT. Allowed support levels: HIGH_SUPPORT, STANDARD, CHALLENGE.

## Notes

Percentages are decision-support estimates, not official grades. Teachers should inspect the evidence logs before accepting or changing the support level. The review uses existing completed tutor sessions and conversation messages; it does not treat AI-generated explanations as proof that the student mastered a topic.