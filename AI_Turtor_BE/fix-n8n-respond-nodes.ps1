$ErrorActionPreference = "Stop"
$source = Join-Path $PSScriptRoot "n8n-import\AI tutor flow.json"
$target = Join-Path $PSScriptRoot "n8n-import\AI-tutor-workflow-runtime-fixed.json"

$fixes = @{
    "Respond RAG" = @'
={{ JSON.stringify({
  success: true,
  mode: "RAG_TUTOR",
  answer: $node["Course RAG Query"].json.answer,
  confidence: $node["Course RAG Query"].json.confidence || null,
  escalated: $node["Course RAG Query"].json.escalated || false,
  questionEscalationId: $node["Course RAG Query"].json.questionEscalationId || null,
  conversationId: $node["Course RAG Query"].json.conversationId || $node["Set - Trace Context"].json.conversationId,
  traceId: $node["Set - Trace Context"].json.traceId,
  sources: $node["Course RAG Query"].json.sources || []
}) }}
'@
    "Respond ESCALATE" = @'
={{ JSON.stringify({
  success: true,
  mode: "ESCALATE",
  escalated: true,
  answer: "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.",
  questionEscalationId: $node["Create Escalation"].json.questionEscalationId,
  conversationId: $node["Set - Trace Context"].json.conversationId,
  traceId: $node["Set - Trace Context"].json.traceId
}) }}
'@
    "Respond CODE" = @'
={{ JSON.stringify({
  success: true,
  mode: "CODE",
  answer: $node["Code Mentor Query"].json.answer,
  confidence: $node["Code Mentor Query"].json.confidence || 0.95,
  escalated: false,
  conversationId: $node["Code Mentor Query"].json.conversationId || $node["Set - Trace Context"].json.conversationId,
  traceId: $node["Set - Trace Context"].json.traceId,
  sources: $node["Code Mentor Query"].json.sources || ["CODE"]
}) }}
'@
    "Respond Review Saved" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "SUBMITTED",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
}) }}
'@
    "Respond Review Saved1" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "SUBMITTED",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
}) }}
'@
    "Respond Sent To Mentor" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "NEEDS_MENTOR_REVIEW",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback đã được gửi cho mentor kiểm tra. AI chưa học từ feedback này."
}) }}
'@
    "Respond Sent To Senior" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "NEEDS_SENIOR_REVIEW",
  reviewId: $node["Create AiAnswerReview"].json.id,
  message: "Feedback cần senior mentor xác nhận trước khi AI được học."
}) }}
'@
    " Respond Approved" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  decision: "APPROVE",
  candidateId: $node["Set Approval Input"].json.candidateId,
  message: "KnowledgeCandidate đã được approve và index vào RAG Brain."
}) }}
'@
    "Respond Candidate Created" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  knowledgeCandidateCreated: true,
  candidateId: $node["Answer Escalation"].json.knowledgeCandidate?.id || null,
  candidateStatus: $node["Answer Escalation"].json.knowledgeCandidate?.status || "PENDING_SENIOR_REVIEW",
  questionEscalationId: $node["Set Teacher Answer Input"].json.questionEscalationId,
  message: "Câu trả lời đã tạo KnowledgeCandidate và đang chờ Senior Mentor/Admin duyệt trước khi AI học."
}) }}
'@
    "Respond Answer Only" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  knowledgeCandidateCreated: false,
  questionEscalationId: $node["Set Teacher Answer Input"].json.questionEscalationId,
  message: "Câu trả lời của mentor đã được lưu và gửi cho học sinh. Không tạo tri thức mới cho AI."
}) }}
'@
    "Respond Rejected" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  decision: "REJECT",
  candidateId: $node["Set Approval Input"].json.candidateId,
  message: "KnowledgeCandidate đã bị reject. AI không học nội dung này."
}) }}
'@
    "Respond Answer Failed" = @'
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể lưu câu trả lời của mentor. Vui lòng thử lại sau.",
  traceId: $node["Set Teacher Answer Input"].json.traceId || "",
  conversationId: $node["Set Teacher Answer Input"].json.conversationId || "",
  questionEscalationId: $node["Set Teacher Answer Input"].json.questionEscalationId,
  error: "TEACHER_ANSWER_FAILED"
}) }}
'@
    "Respond Review Failed" = @'
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể lưu đánh giá câu trả lời AI. Vui lòng thử lại sau.",
  traceId: $node["Set Normalize Review Input"].json.traceId,
  conversationId: $node["Set Normalize Review Input"].json.conversationId,
  error: "ANSWER_REVIEW_FAILED"
}) }}
'@
    "Respond Failed" = @'
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  message: "Không thể nộp quiz lúc này. Vui lòng thử lại sau.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId,
  quizSessionId: $node["Set: Normalize Quiz Submit"].json.quizSessionId,
  error: "QUIZ_SUBMIT_FAILED"
}) }}
'@
    "Respond Submitted Waiting Teacher Review" = @'
={{ JSON.stringify({
  success: true,
  status: "SUBMITTED_WAITING_TEACHER_REVIEW",
  quizType: "ASSIGNED",
  quizSessionId: $json.id || $node["Set: Normalize Quiz Submit"].json.quizSessionId,
  score: $json.score,
  maxScore: $json.maxScore,
  percentage: $json.percentage,
  teacherReviewStatus: $json.teacherReviewStatus || "PENDING_REVIEW",
  message: "Bài quiz đã được nộp và chấm tạm thời. Mentor sẽ review lại điểm/bài làm.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId
}) }}
'@
    "Respond Self Practice Score" = @'
={{ JSON.stringify({
  success: true,
  status: "SUBMITTED",
  quizType: $json.quizType || "SELF_PRACTICE",
  quizSessionId: $json.id || $node["Set: Normalize Quiz Submit"].json.quizSessionId,
  score: $json.score,
  maxScore: $json.maxScore,
  percentage: $json.percentage,
  message: "Quiz đã được chấm. Kết quả đã cập nhật vào memory học tập.",
  traceId: $node["Set: Normalize Quiz Submit"].json.traceId
}) }}
'@
    "Respond Failed1" = @'
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  quizType: "SELF_PRACTICE",
  message: "Không thể tạo quiz tự ôn lúc này.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId,
  error: "QUIZ_GENERATE_FAILED"
}) }}
'@
    "Respond Failed3" = @'
={{ JSON.stringify({
  success: false,
  status: "FAILED",
  quizType: "TEACHER_ASSIGNMENT",
  message: "Không thể tạo draft quiz cho giáo viên lúc này.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId,
  error: "QUIZ_ASSIGNMENT_GENERATE_FAILED"
}) }}
'@
    "Respond Teacher Draft Created" = @'
={{ JSON.stringify({
  success: true,
  status: "DRAFT_CREATED",
  quizType: "TEACHER_ASSIGNMENT",
  assignmentId: $node["Generate Teacher Assignment Draft"].json.id,
  assignment: $node["Generate Teacher Assignment Draft"].json,
  message: "Draft quiz đã được tạo từ tài liệu. Mentor có thể review, sửa, xóa hoặc publish.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId
}) }}
'@
    "Respond Student Quiz" = @'
={{ JSON.stringify({
  success: true,
  status: "GENERATED",
  quizType: "SELF_PRACTICE",
  quizSessionId: $node["Generate Student Practice Quiz"].json.id,
  message: "Quiz tự ôn đã được tạo từ tài liệu môn học.",
  traceId: $node["Set: Normalize Quiz Generate Input"].json.traceId
}) }}
'@
    "Respond Senior Resolve Failed" = @'
={{ JSON.stringify({
  ok: false,
  success: false,
  status: "SENIOR_RESOLVE_FAILED",
  reviewId: $node["Set Normalize Senior Resolution"].json.reviewId,
  error: $json.error?.message || $json.message || $json.body?.error || "Khong the xu ly review hoac tao candidate"
}) }}
'@
    "Respond Review Candidate Created" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "RESOLVED",
  reviewId: $json.id,
  candidateId: $json.linkedKnowledgeCandidateId,
  candidateStatus: "PENDING_SENIOR_REVIEW",
  nextStep: "SEND_TO_FLOW_3"
}) }}
'@
    "Respond Senior Review Resolved" = @'
={{ JSON.stringify({
  ok: true,
  success: true,
  status: "RESOLVED",
  reviewId: $json.id,
  candidateId: null,
  nextStep: "NONE"
}) }}
'@
}

$wf = Get-Content -Raw -Encoding UTF8 $source | ConvertFrom-Json
$wf.id = "bdFmRV9u8BFGBfpL"
$wf.active = $true
$fixedCount = 0

foreach ($node in $wf.nodes) {
    if ($node.type -ne "n8n-nodes-base.respondToWebhook") { continue }
    if (-not $fixes.ContainsKey($node.name)) {
        Write-Warning "No fix mapping for respond node: $($node.name)"
        continue
    }
    $node.parameters.responseBody = $fixes[$node.name].Trim()
    $fixedCount++
}

# Keep the imported workflow encoding-safe across Windows PowerShell/n8n and
# correct the real node name used by the quiz-submit branch.
$safeMessages = @{
    "Respond Review Saved" = "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
    "Respond Review Saved1" = "Feedback đã được ghi nhận để phân tích chất lượng câu trả lời."
    "Respond Sent To Mentor" = "Feedback đã được gửi cho mentor kiểm tra. AI chưa học từ feedback này."
    "Respond Sent To Senior" = "Feedback cần senior mentor xác nhận trước khi AI được học."
    "Respond Candidate Created" = "Câu trả lời đã tạo KnowledgeCandidate và đang chờ senior/admin duyệt."
    "Respond Answer Only" = "Câu trả lời của mentor đã được gửi cho học sinh; AI không học nội dung này."
    " Respond Approved" = "KnowledgeCandidate đã được approve và index vào RAG Brain."
    "Respond Rejected" = "KnowledgeCandidate đã bị reject; AI không học nội dung này."
    "Respond Submitted Waiting Teacher Review" = "Bài quiz đã nộp và chấm tạm thời; mentor sẽ review điểm cuối."
    "Respond Self Practice Score" = "Quiz đã được chấm và kết quả đã cập nhật vào learning memory."
    "Respond Failed" = "Không thể nộp quiz lúc này. Vui lòng thử lại sau."
    "Respond Student Quiz" = "Quiz tự ôn đã được tạo từ tài liệu môn học."
    "Respond Teacher Draft Created" = "Draft quiz đã được tạo; mentor có thể sửa, xóa hoặc publish."
    "Respond Answer Failed" = "Không thể lưu câu trả lời của mentor. Vui lòng thử lại sau."
    "Respond Review Failed" = "Không thể lưu đánh giá câu trả lời AI. Vui lòng thử lại sau."
    "Respond Failed1" = "Không thể tạo quiz tự ôn lúc này."
    "Respond Failed3" = "Không thể tạo draft quiz cho giáo viên lúc này."
}
$safeAnswers = @{
    "Respond ESCALATE" = "Câu hỏi đã được gửi cho giáo viên/mentor phụ trách."
}

foreach ($node in $wf.nodes) {
    if ($node.type -eq "n8n-nodes-base.respondToWebhook") {
        $node.parameters.responseBody = $node.parameters.responseBody.Replace('Set: Normalize Quiz Submit', 'Set - Normalize Quiz Submit')
        if ($safeMessages.ContainsKey($node.name)) {
            $replacement = 'message: "' + $safeMessages[$node.name] + '"'
            $node.parameters.responseBody = [regex]::Replace($node.parameters.responseBody, 'message:\s*"[^"]*"', $replacement)
        }
        if ($safeAnswers.ContainsKey($node.name)) {
            $replacement = 'answer: "' + $safeAnswers[$node.name] + '"'
            $node.parameters.responseBody = [regex]::Replace($node.parameters.responseBody, 'answer:\s*"[^"]*"', $replacement)
        }
    }

    if ($node.name -eq "Reject Candidate") {
        $parameters = @($node.parameters.bodyParameters.parameters)
        if (-not ($parameters | Where-Object { $_.name -eq "rejectionReason" })) {
            $parameters += [pscustomobject]@{
                name = "rejectionReason"
                value = '={{$node["Set Approval Input"].json.rejectionReason || $node["Set Approval Input"].json.reviewNote}}'
            }
            $node.parameters.bodyParameters.parameters = $parameters
        }
    }

    if ($node.name -eq "Set - Normalize Quiz Submit") {
        $node.parameters.jsonOutput = @'
={{ {
  traceId: $json.body.traceId || ('quiz-submit-' + Date.now()),
  sessionId: $json.body.sessionId || '',
  conversationId: $json.body.conversationId || '',
  authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || '',
  quizSessionId: $json.body.quizSessionId,
  studentId: $json.body.studentId || '',
  courseId: $json.body.courseId || '',
  classId: $json.body.classId || '',
  answers: $json.body.answers || []
} }}
'@.Trim()
    }
}

$wf | ConvertTo-Json -Depth 100 | Set-Content -Encoding UTF8 $target
Write-Host "Fixed $fixedCount respond nodes -> $target"
