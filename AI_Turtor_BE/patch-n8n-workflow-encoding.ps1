$ErrorActionPreference = "Stop"

function Convert-ToN8nExpression([string]$value) {
    return ($value -replace "'", '\u0027') -replace "`r`n", "`n" -replace "`n", '\n'
}

function Set-NodeJsonOutput($node, [string]$expression) {
    if ($null -eq $node.parameters) { return }
    $node.parameters | Add-Member -NotePropertyName mode -NotePropertyValue "raw" -Force
    $node.parameters.jsonOutput = Convert-ToN8nExpression $expression
}

$setNodeExpressions = @{
    "Set Normalize Review Input" = @'
=={{
  {
    traceId: $json.body.traceId || 'review-' + Date.now(),
    sessionId: $json.body.sessionId || '',
    conversationId: $json.body.conversationId || '',
    authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || '',
    studentId: $json.body.studentId,
    courseId: $json.body.courseId,
    classId: $json.body.classId || '',
    questionEscalationId: $json.body.questionEscalationId || '',
    mode: $json.body.mode || 'RAG',
    reviewType: $json.body.reviewType || ((Number($json.body.rating) <= 3 || $json.body.accurate === false) ? 'ANSWER_DISPUTE' : 'QUALITY_FEEDBACK'),
    question: $json.body.question || '',
    answer: $json.body.answer || '',
    aiConfidence: $json.body.aiConfidence ?? '',
    rating: $json.body.rating,
    accurate: $json.body.accurate,
    helpful: $json.body.helpful,
    correctnessLevel: $json.body.correctnessLevel || '',
    feedback: $json.body.feedback || '',
    suggestedCorrection: $json.body.suggestedCorrection || '',
    reviewedBy: $json.body.reviewedBy || $json.body.studentId,
    reviewerRole: $json.body.reviewerRole || 'STUDENT'
  }
}}
'@
    "Set Teacher Answer Input" = @'
=={{
  {
    traceId: $json.body.traceId || 'teacher-answer-' + Date.now(),
    sessionId: $json.body.sessionId || '',
    conversationId: $json.body.conversationId || '',
    authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || '',
    questionEscalationId: $json.body.questionEscalationId,
    teacherId: $json.body.teacherId,
    teacherName: $json.body.teacherName || '',
    answer: $json.body.answer || '',
    createKnowledgeCandidate: $json.body.createKnowledgeCandidate,
    candidateType: $json.body.candidateType || 'OPERATIONAL_POLICY'
  }
}}
'@
    "Set Approval Input" = @'
=={{
  {
    traceId: $json.body.traceId || 'senior-approval-' + Date.now(),
    sessionId: $json.body.sessionId || '',
    conversationId: $json.body.conversationId || '',
    authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || '',
    authorization: $json.headers.authorization || ('Bearer ' + ($json.body.authToken || '')),
    candidateId: $json.body.candidateId,
    decision: $json.body.decision,
    reviewerId: $json.body.reviewerId,
    reviewerRole: $json.body.reviewerRole || 'SENIOR_MENTOR',
    reviewerName: $json.body.reviewerName || '',
    reviewNote: $json.body.reviewNote || '',
    rejectionReason: $json.body.rejectionReason || ''
  }
}}
'@
    "Set Normalize Senior Resolution" = @'
=={{
  {
    traceId: $json.body.traceId || 'senior-resolve-' + Date.now(),
    authToken: $json.body.authToken || (($json.headers.authorization || '').replace('Bearer ', '')) || '',
    reviewId: $json.body.reviewId || '',
    seniorReviewerId: $json.body.seniorReviewerId || '',
    seniorReviewerName: $json.body.seniorReviewerName || '',
    reviewerRole: String($json.body.reviewerRole || 'SENIOR_MENTOR').trim().toUpperCase(),
    decision: String($json.body.decision || 'CREATE_KNOWLEDGE_CANDIDATE').trim().toUpperCase(),
    notes: $json.body.notes || '',
    createKnowledgeCandidate: $json.body.createKnowledgeCandidate === true || String($json.body.createKnowledgeCandidate || '').toLowerCase() === 'true',
    candidateType: String($json.body.candidateType || 'ACADEMIC_KNOWLEDGE').trim().toUpperCase(),
    correctedAnswer: $json.body.correctedAnswer || ''
  }
}}
'@
}

$messageReplacements = [ordered]@{
    'Cau hoi da duoc gui cho giao vien/mentor phu trach.' = 'Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.'
    'Feedback da duoc ghi nhan de phan tich chat luong cau tra loi.' = 'Feedback đã được ghi nhận để phân tích chất lượng câu trả lời.'
    'Feedback da duoc gui cho mentor kiem tra. AI chua hoc tu feedback nay.' = 'Feedback đã được gửi cho mentor kiểm tra. AI chưa học từ feedback này.'
    'Feedback can senior mentor xac nhan truoc khi AI duoc hoc.' = 'Feedback cần senior mentor xác nhận trước khi AI được học.'
    'KnowledgeCandidate da duoc approve va index vao RAG Brain.' = 'KnowledgeCandidate đã được approve và index vào RAG Brain.'
    'Cau tra loi cua mentor da duoc gui cho hoc sinh; AI khong hoc noi dung nay.' = 'Câu trả lời của mentor đã được gửi cho học sinh; AI không học nội dung này.'
    'Khong the luu cau tra loi cua mentor. Vui long thu lai sau.' = 'Không thể lưu câu trả lời của mentor. Vui lòng thử lại sau.'
    'Khong the luu danh gia cau tra loi AI. Vui long thu lai sau.' = 'Không thể lưu đánh giá câu trả lời AI. Vui lòng thử lại sau.'
    'Khong the nop quiz luc nay. Vui long thu lai sau.' = 'Không thể nộp quiz lúc này. Vui lòng thử lại sau.'
    'Quiz da duoc cham va ket qua da cap nhat vao learning memory.' = 'Quiz đã được chấm và kết quả đã cập nhật vào learning memory.'
    'Khong the tao quiz tu on luc nay.' = 'Không thể tạo quiz tự ôn lúc này.'
    'Khong the tao draft quiz cho giao vien luc nay.' = 'Không thể tạo draft quiz cho giáo viên lúc này.'
    'Draft quiz da duoc tao; mentor co the sua, xoa hoac publish.' = 'Draft quiz đã được tạo; mentor có thể sửa, xóa hoặc publish.'
    'Quiz tu on da duoc tao tu tai lieu mon hoc.' = 'Quiz tự ôn đã được tạo từ tài liệu môn học.'
    'Khong the xu ly review hoac tao candidate' = 'Không thể xử lý review hoặc tạo candidate'
    'KnowledgeCandidate da bi reject; AI khong hoc noi dung nay.' = 'KnowledgeCandidate đã bị reject; AI không học nội dung này.'
    'Cau tra loi da tao KnowledgeCandidate va dang cho senior/admin duyet.' = 'Câu trả lời đã tạo KnowledgeCandidate và đang chờ senior/admin duyệt.'
    'Bai quiz da nop va cham tam thoi; mentor se review diem cuoi.' = 'Bài quiz đã nộp và chấm tạm thời; mentor sẽ review điểm cuối.'
}

function Patch-WorkflowFile([string]$path) {
    if (-not (Test-Path $path)) {
        Write-Warning "Skip missing workflow: $path"
        return
    }

    $json = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json
    $setFixed = 0
    $messageFixed = 0

    foreach ($node in $json.nodes) {
        if ($setNodeExpressions.ContainsKey($node.name)) {
            Set-NodeJsonOutput $node $setNodeExpressions[$node.name]
            $setFixed++
        }

        if ($node.type -eq "n8n-nodes-base.respondToWebhook" -and $node.parameters.responseBody) {
            $body = [string]$node.parameters.responseBody
            foreach ($entry in $messageReplacements.GetEnumerator()) {
                if ($body.Contains($entry.Key)) {
                    $body = $body.Replace($entry.Key, $entry.Value)
                    $messageFixed++
                }
            }
            $node.parameters.responseBody = $body
        }
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, ($json | ConvertTo-Json -Depth 100), $utf8NoBom)
    Write-Host "Patched $path -> set nodes: $setFixed, message replacements: $messageFixed"
}

$root = $PSScriptRoot
Patch-WorkflowFile (Join-Path $root "n8n-import\docker-ready\AI-tutor-workflow-runtime-fixed.json")
Patch-WorkflowFile (Join-Path $root "n8n-import\AI-tutor-workflow-runtime-fixed.json")

Write-Host "Done patching n8n workflow encoding fixes."
