# BE/n8n Fix Request: Student Chat RAG Response Is Empty

## Hiện tượng

Student Chat gọi workflow n8n thành công, Spring Boot sinh và lưu câu trả lời vào conversation, nhưng FE nhận `answer` rỗng nên không hiển thị nội dung AI.

## Nguyên nhân đã xác minh

Trong workflow `AI-tutor-workflow-runtime-fixed`, nhánh RAG kết thúc tại node `Respond RAG` bằng object Student Memory. Object này có các field như `studentId`, `summary`, `weakTopics`, `recentAnswers` nhưng không có `answer` và metadata của exchange vừa tạo.

Node `Course RAG Query` trước đó đã nhận response đúng từ Spring Boot và backend đã persist exchange. Vì vậy lỗi không nằm ở LLM hoặc database.

## Contract cần trả về

`Respond RAG` phải lấy output của `Course RAG Query` và trả JSON tối thiểu:

```json
{
  "success": true,
  "answer": "...",
  "mode": "RAG",
  "conversationId": "...",
  "userMessageId": "...",
  "assistantMessageId": "...",
  "confidence": 0.8,
  "sources": [],
  "sourceEvidence": [],
  "groundingType": "COURSE_MATERIAL",
  "nextImproveSuggestions": []
}
```

Student Memory có thể được merge vào field riêng, nhưng không được thay thế response chat.

## Biện pháp phía FE

FE sẽ phục hồi exchange canonical từ REST conversation history khi n8n thiếu `answer`. FE chỉ chấp nhận câu trả lời đã được backend lưu và khớp chính xác với câu hỏi vừa gửi; không mock hoặc tự tạo thành công.
