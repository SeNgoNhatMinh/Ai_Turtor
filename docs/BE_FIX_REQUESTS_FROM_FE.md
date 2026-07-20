# Backend Fix Requests From Frontend

File này ghi lại các lỗi/điểm nghẽn backend đang ảnh hưởng trực tiếp đến frontend. Mục tiêu là để BE fix theo endpoint và behavior rõ ràng, tránh FE phải workaround quá nhiều.

## Snapshot

- FE dev URL: `http://localhost:5173`
- BE base URL: `http://localhost:8085/api`
- Admin test account hiện kỳ vọng:
  - Email: `admin@system.local`
  - Password: `admin123`
- FE không gọi LLM trực tiếp. Các flow AI/quiz/material đều đi qua backend.

## 1. Admin Account Dễ Bị Xóa

**Hiện tượng**
- FE/Admin có thể xóa nhầm user `admin@system.local`.
- Khi admin bị xóa, login admin fail `401`.
- Backend có `AdminAccountInitializer`, restart BE có thể tạo lại admin nếu email không còn tồn tại.

**Expected**
- Không cho xóa system admin mặc định.
- Hoặc endpoint delete user phải trả `400/403` với message rõ:
  - `System admin account cannot be deleted.`

**Endpoint liên quan**
- `DELETE /api/admin/users/{userId}`
- Login verify: `POST /api/users/login`

**BE đề xuất**
- Chặn delete nếu `email == admin@system.local` hoặc role/system flag.
- Nếu vẫn muốn cho xóa, cần endpoint restore admin hoặc seed admin thủ công không cần restart.

**Test**
1. Login admin.
2. Gọi delete user với user admin mặc định.
3. Expected: API không xóa, trả lỗi thân thiện.
4. Login lại `admin@system.local / admin123` vẫn thành công.

## 2. Class Section Not Found Với Default `PRJ301 / SE1840`

**Hiện tượng**
- Nhiều request trả `404`/`400`:
  - `GET /api/academic/courses/PRJ301/class-sections/SE1840/students`
  - `GET /api/mentor/courses/PRJ301/classes/SE1840/submissions?teacherId=...`
- Response thường là:
  - `Class section not found`
- FE đã cố lấy enrollment thật cho student, nhưng khi DB chưa có class section/enrollment đúng thì UI vẫn bị rỗng/lỗi.

**Expected**
- Dữ liệu seed/dev phải có tối thiểu:
  - course `PRJ301`
  - class section `SE1840`
  - teacher/mentor được assign vào class
  - student enrolled vào class
- Hoặc backend trả danh sách course/class mặc định để FE chọn context hợp lệ.

**Endpoint liên quan**
- `GET /api/courses/{courseId}/class-sections`
- `GET /api/academic/courses/{courseId}/class-sections/{classId}/students`
- `GET /api/students/{studentId}/enrollments`
- `GET /api/teachers/{teacherId}/classes`

**BE đề xuất**
- Thêm seed/dev bootstrap data cho course/class/enrollments.
- Nếu không có class, response nên có message hướng dẫn:
  - `Class section PRJ301/SE1840 does not exist. Please create class section and enroll students first.`

**Test**
1. Login student test.
2. Gọi `GET /api/students/{studentId}/enrollments`.
3. FE phải nhận ít nhất một item có `courseId` và `classId`.
4. Gọi students/submissions theo course/class đó không trả `Class section not found`.

## 3. Upload Material Có Thể Timeout Nhưng File Vẫn Được Lưu

**Hiện tượng**
- FE upload material thấy request lâu hoặc timeout.
- Sau khi refresh/list lại thì material đã tồn tại.
- Điều này tạo cảm giác upload lỗi nhưng thực tế BE đã nhận file và đang extract/index.

**Expected**
- Upload không nên giữ HTTP request quá lâu cho toàn bộ indexing.
- BE nên tách upload và indexing:
  - Upload trả nhanh `200` hoặc `202`
  - Response có `materialId`, `indexingStatus`
  - FE poll status hoặc reload list.

**Endpoint liên quan**
- `POST /api/courses/{courseId}/materials/upload`
- `GET /api/courses/{courseId}/materials`
- `POST /api/courses/{courseId}/materials/{materialId}/reindex`

**BE đề xuất**
- Response upload mẫu:

```json
{
  "materialId": "xxx",
  "courseId": "PRJ301",
  "title": "Lecture 01",
  "indexingStatus": "PROCESSING",
  "message": "Material uploaded. Indexing is running in background."
}
```

- Material list nên trả thêm:
  - `indexingStatus`: `PROCESSING | INDEXED | FAILED`
  - `indexedAt`
  - `indexingError` nếu fail

**Test**
1. Upload PDF lớn.
2. API trả trong thời gian ngắn.
3. `GET /materials` thấy material ngay với status.
4. Khi indexing xong, status đổi `INDEXED`.

## 4. Create Quiz Dễ Timeout Vì AI/RAG Chạy Lâu

**Hiện tượng**
- `Create quiz` có thể timeout nếu backend gọi AI/RAG lâu.
- FE đã tăng timeout riêng lên 180 giây, nhưng đó chỉ là workaround.

**Expected**
- Quiz generation nên trả job/session status rõ.
- Nếu thiếu tài liệu indexed, trả `400` message rõ thay vì timeout hoặc lỗi chung.

**Endpoint liên quan**
- `POST /api/tutor/students/{studentId}/courses/{courseId}/quizzes/generate`
- `POST /api/tutor/teachers/{teacherId}/courses/{courseId}/quiz-assignments/generate`

**BE đề xuất**
- Nếu thiếu material indexed:

```json
{
  "error": "NOT_ENOUGH_INDEXED_MATERIAL",
  "message": "Not enough indexed course material to generate this quiz."
}
```

- Nếu generation chạy lâu, cân nhắc:
  - `202 Accepted`
  - `quizJobId`
  - endpoint poll status.

**Test**
1. Course chưa có indexed material.
2. Generate quiz phải trả lỗi rõ trong vài giây.
3. Course có material indexed.
4. Generate quiz trả quiz/session hợp lệ, không lộ answer key cho student.

## 5. Conversation Theo Course Cần Nhất Quán

**Hiện tượng**
- Flow mới yêu cầu chat riêng theo `studentId + courseId`.
- FE gọi conversation list/search/create có `courseId` khi có context, nhưng BE cần đảm bảo lọc thật theo course.

**Endpoint liên quan**
- `GET /api/ai/conversations?userId=&courseId=`
- `POST /api/ai/conversations?userId=&courseId=`
- `GET /api/ai/conversations/search?userId=&keyword=&courseId=`
- `POST /api/ai/query?userId=`

**Expected**
- Conversation của `PRJ301` không xuất hiện khi user chọn `DBI202`.
- Nếu `/api/ai/query` trả `conversationId` mới, FE sẽ chuyển sang conversation đó.
- Response nên luôn trả:
  - `conversationId`
  - `userMessageId`
  - `assistantMessageId`
  - `courseId`

**Test**
1. Student hỏi trong `PRJ301`.
2. Đổi sang `DBI202`.
3. Conversation list không lẫn session `PRJ301`.
4. Gửi hơn giới hạn 10 câu nếu backend tự tạo conversation mới, response có `conversationId` mới.

## 6. Pin Message Backend Persistence

**Hiện tượng**
- FE cần pin message giống Zalo/Facebook: pinned nằm trên topbar, click nhảy tới message.
- Để refresh không mất pin, BE phải persist pin theo `conversationId + messageId + userId`.

**Endpoint liên quan**
- `PATCH /api/ai/conversations/{conversationId}/messages/{messageId}/pin?userId=`
- `DELETE /api/ai/conversations/{conversationId}/messages/{messageId}/pin?userId=`
- `GET /api/ai/conversations/{conversationId}/pinned-messages?userId=`

**Expected**
- `GET pinned-messages` trả list message đủ field để FE preview/jump:
  - `messageId`
  - `question` hoặc `content`
  - `answer` nếu là AI message
  - `createdAt`
  - `pinnedAt`
- BE nên giới hạn tối đa 3 pinned messages/conversation, hoặc trả lỗi rõ nếu quá giới hạn.

**Test**
1. Pin 1 message.
2. Refresh page.
3. `GET pinned-messages` vẫn trả message đó.
4. Unpin message.
5. Refresh page, message không còn pinned.

## 7. Friendly Error Contract

**Hiện tượng**
- FE không nên show raw stack trace/lỗi kỹ thuật.
- Một số lỗi backend hiện trả message chưa nhất quán hoặc quá chung.
- Khi user gõ sai chính tả hoặc AI/LLM unavailable, chat có thể trả ra text bị lỗi encoding/mojibake:
  - Actual: `Lá»—i mÃ¡y chá»§: AI Tutor chÆ°a thá»ƒ gá»i dá»‹ch vá»¥ LLM. Vui lÃ²ng thá»­ láº¡i sau.`
  - Expected: `Lỗi máy chủ: AI Tutor chưa thể gọi dịch vụ LLM. Vui lòng thử lại sau.`

**Expected**
- API error JSON nên thống nhất:

```json
{
  "code": "CLASS_SECTION_NOT_FOUND",
  "message": "Class section PRJ301/SE1840 does not exist.",
  "details": {}
}
```

- Tất cả response JSON phải encode UTF-8 đúng:
  - `Content-Type: application/json;charset=UTF-8` hoặc Spring default UTF-8 không bị override.
  - Không convert tiếng Việt qua ISO-8859-1.
  - Không double-encode string trước khi trả về JSON.

**BE đề xuất**
- Chuẩn hóa error response cho:
  - material upload/indexing
  - quiz generation
  - class section/enrollment
  - AI/RAG unavailable
  - delete protected system account
- Với lỗi LLM unavailable, không trả text lỗi trực tiếp trong `answer` nếu đó là lỗi hệ thống. Nên trả HTTP error hoặc response có `mode/errorCode` rõ:

```json
{
  "code": "LLM_UNAVAILABLE",
  "message": "AI Tutor service is temporarily unavailable. Please try again in a moment."
}
```

- Nếu BE vẫn muốn trả trong chat bubble, cần trả tiếng Việt/English đúng UTF-8, không mojibake:

```json
{
  "mode": "ERROR",
  "answer": "AI Tutor service is temporarily unavailable. Please try again in a moment.",
  "errorCode": "LLM_UNAVAILABLE"
}
```

- Kiểm tra các vị trí có thể gây mojibake:
  - `new String(bytes)` không truyền `StandardCharsets.UTF_8`
  - đọc response từ LLM bằng charset mặc định
  - convert lỗi tiếng Việt từ properties/log/message qua charset sai
  - filter/interceptor tự set encoding ISO-8859-1
  - error message hard-code trong file không lưu UTF-8

**Test**
1. Gọi API lỗi có chủ đích.
2. FE nhận `message` thân thiện và `code` để map UI.
3. Gõ câu sai chính tả hoặc mô phỏng LLM unavailable qua `POST /api/ai/query`.
4. Response không được chứa chuỗi mojibake như `Lá»`, `mÃ`, `chÆ`, `Vui lÃ²ng`.

## 8. Course Alias `OSG` Không Khớp Material `OSG202`

**Hiện tượng**
- Người dùng thấy môn OSG có tài liệu, nhưng khi hỏi AI Tutor thì AI trả:
  - `Hệ thống chưa có tài liệu của môn OSG để AI Tutor trả lời.`
- Test trực tiếp cho thấy đây không phải lỗi LLM, mà là lỗi context `courseId` không khớp.
- FE đã fix phía client để ưu tiên canonical `courseId` từ enrollment/options, ví dụ `OSG202`. Phần BE bên dưới là note optional nếu muốn hỗ trợ alias như `OSG`.

**Bằng chứng local**
- `GET /api/courses/OSG/materials` trả:

```json
{
  "courseId": "OSG",
  "count": 0,
  "materials": []
}
```

- `GET /api/courses/OSG202/materials` có material:

```json
{
  "courseId": "OSG202",
  "materials": [
    {
      "id": "6a42aa32e4f8d1562ee70a72",
      "title": "lession 1",
      "indexingStatus": "INDEXED"
    }
  ]
}
```

- Elasticsearch index `course_material_vectors` có chunks theo `courseId=OSG202`, không phải `OSG`:

```txt
OSG202 -> 2118 chunks
```

- `POST /api/ai/query` với `courseId=OSG` trả `escalated=true`, `sources=[]`.
- `POST /api/ai/query` với `courseId=OSG202` trả answer bình thường, `sources=["materialId=6a42aa32e4f8d1562ee70a72"]`.

**Nguyên nhân**
- Backend RAG search đang filter chính xác theo `courseId`.
- Material và course record đang dùng canonical code `OSG202`.
- FE hoặc dữ liệu UI có thể đang hiển thị/gửi alias rút gọn `OSG`.
- Vì `CourseRagService` và fallback Mongo đều dùng exact `courseId`, alias `OSG` sẽ không tìm thấy tài liệu `OSG202`.

**Expected**
- FE phải gửi canonical `courseId` đúng backend, ví dụ `OSG202`, không gửi label/alias `OSG`.
- Nếu backend muốn hỗ trợ alias thì cần mapping rõ ràng:
  - `OSG` -> `OSG202`
  - Alias mapping phải áp dụng đồng nhất cho material list, AI query, quiz generation, conversation course scope, enrollment.

**Endpoint liên quan**
- `GET /api/courses/{courseId}/materials`
- `POST /api/ai/query`
- `GET /api/students/{studentId}/enrollments`
- `GET /api/courses`

**BE/FE đề xuất**
- FE dropdown course phải dùng `value=courseId` canonical, label có thể là `OSG202 - Operating Systems`. FE đã thêm guard/resolver cho case state cũ lưu `OSG`.
- Backend nên trả `courseId` canonical và optional `courseAlias`/`displayCode` riêng nếu muốn UI hiển thị tên ngắn.
- Không dùng label text hoặc prefix rút gọn để gửi API.
- Nếu backend muốn alias, thêm endpoint hoặc resolver dùng chung:
  - `resolveCourseId("OSG") => "OSG202"`
  - Không để từng service tự xử lý khác nhau.

**Test**
1. Login student enrolled môn Operating Systems.
2. FE course selector value phải là `OSG202`.
3. `GET /api/courses/OSG202/materials` có material indexed.
4. Gửi chat AI với payload `courseId: "OSG202"`.
5. Response phải có `escalated=false`, `sources` không rỗng.
6. Nếu cố gửi `courseId: "OSG"`, BE nên trả lỗi rõ hoặc resolve sang `OSG202`, không âm thầm nói “chưa có tài liệu” nếu `OSG` chỉ là alias hợp lệ.

## 9. Cấu trúc Chunking PDF của Backend Không Tương Thích Với Markdown (jsPDF)

**Hiện tượng**
- FE đã crawl tài liệu thành công bằng Jina AI và tạo ra file PDF chứa toàn bộ nội dung Markdown (để giữ nguyên bảng biểu, code block cho RAG).
- Upload thành công lên BE, status đổi thành `INDEXED`.
- Tuy nhiên, khi hỏi AI Tutor (ví dụ môn PRJ301), AI luôn trả lời: 
  - `Tài liệu hiện có của môn PRJ301 không có nội dung đủ phù hợp để trả lời chắc chắn. Câu hỏi sẽ được chuyển cho giáo viên/mentor phụ trách...`

**Nguyên nhân (từ logic Chunking của BE)**
- `CourseMaterialChunkingService.java` hiện đang dùng Regex để tìm Heading:
  ```java
  Pattern.compile("(?m)^(?=\\s*(chapter|section|unit|lesson|module|part|slide)\\s+\\d+|\\s*\\d+(\\.\\d+)*\\s+\\S)");
  ```
- File PDF do FE tạo ra chứa chuẩn **Markdown**, các Heading sẽ bắt đầu bằng dấu `#` (ví dụ: `# 1. Introduction`, `## Background`). Do đó, Regex của BE hoàn toàn **không bắt được bất kỳ Heading nào**.
- Khi không bắt được Heading, BE fallback sang cắt theo đoạn văn (`splitByParagraphs` dùng `\R{2,}`). Tuy nhiên, do đặc thù của thư viện `jsPDF` khi vẽ text lên Canvas, `PDFTextStripper` của BE (Apache PDFBox) có thể không nhận diện được `\n\n`.
- Cuối cùng, BE fallback sang phương án tệ nhất: **Cắt cứng mỗi 1000 ký tự** (`splitByLength`). Việc cắt mù này làm đứt gãy câu chữ, code block và bảng biểu, khiến Vector Search của Elasticsearch bị mất hoàn toàn ngữ nghĩa (Semantic), dẫn đến AI không tìm thấy context phù hợp.

**Expected / BE Đề xuất**
- Cập nhật `HEADING_PATTERN` trong `CourseMaterialChunkingService` để hỗ trợ thêm chuẩn Markdown (dấu `#`):
  ```java
  // Bổ sung thêm matching cho các dòng bắt đầu bằng 1 đến 6 dấu #
  Pattern.compile("(?m)^(?=\\s*(#{1,6}\\s+)?(chapter|section|unit|lesson|module|part|slide)\\s+\\d+|\\s*(#{1,6}\\s+)?\\d+(\\.\\d+)*\\s+\\S|\\s*#{1,6}\\s+\\S)");
  ```
- Hoặc hỗ trợ thêm một `sourceType` mới là `MARKDOWN` để chunking chuẩn xác hơn bằng Markdown Parser thay vì xử lý nó như một file PDF thông thường.

**Test**
1. Upload file PDF được tạo từ FE (có chứa cú pháp `# Heading`).
2. Xem log BE báo `Course material chunked into X chunks`. X phải lớn hơn số trang, và các chunk không bị cắt đứt giữa câu.
3. Chat với AI Tutor, AI phải tìm thấy context và trả lời đúng nội dung trong PDF.

## 10. Quiz Có Thể Dùng Context Không Liên Quan Khi Retrieval Không Có Kết Quả Phù Hợp

**Hiện tượng**
- Student hoặc Teacher chọn đúng course/class nhưng quiz được tạo ra có kiến thức của topic khác, thậm chí giống nội dung môn khác.

**Nguyên nhân từ code BE hiện tại**
- `QuizService.generateQuiz` tìm context theo `courseId`, `classId`, `topic` và `suggestionText`.
- Elasticsearch có filter `courseId.keyword` và hậu kiểm class visibility.
- Tuy nhiên `CourseMaterialFallbackSearchService` dùng `firstAvailable` khi không có chunk liên quan tới topic.
- `RerankService` chỉ sắp xếp/cắt top K, không loại các chunk dưới ngưỡng relevance tối thiểu.
- Vì vậy backend vẫn có thể gửi context không liên quan cho LLM thay vì từ chối tạo quiz.

**Expected**
- Không dùng `firstAvailable` để tạo quiz khi không có chunk liên quan.
- Áp dụng minimum relevance threshold sau Elasticsearch/rerank.
- Hậu kiểm mọi chunk phải có `courseId` đúng course request và class visibility hợp lệ.
- Nếu không đủ context, trả `400/422` với code như `INSUFFICIENT_QUIZ_MATERIAL`.
- Response quiz nên trả source metadata gồm `materialId`, `materialTitle`, `courseId`, `classId`, `score` để FE hiển thị và audit.

**Test**
1. Course OSG202 chỉ có tài liệu Operating Systems.
2. Yêu cầu quiz topic không tồn tại như `Java servlet`.
3. BE phải từ chối bằng `INSUFFICIENT_QUIZ_MATERIAL`, không lấy chunk đầu tiên để tạo quiz.
4. Với topic hợp lệ, tất cả source chunks phải có `courseId=OSG202` và class scope hợp lệ.

## 11. Tutor V2 Guide Dùng Sai Tên Field Evaluation So Với Java DTO

**Hiện tượng**
- `TUTOR_V2_IMPLEMENTATION_AND_TEST_GUIDE_VI.md` có ví dụ evaluation dùng `minimumPassScore` và `maximumHallucinationRate`.
- Java DTO thực tế `StartEvalRunRequest` chỉ nhận `passThreshold`, không có hai field trên.

**FE đang xử lý**
- FE bám controller/DTO thực thi và gửi `passThreshold`.
- UI không hiển thị `maximumHallucinationRate` vì Backend chưa có field/nghiệp vụ tương ứng.

**Yêu cầu BE docs**
- Sửa ví dụ request theo `StartEvalRunRequest`, hoặc bổ sung DTO/service nếu hai ngưỡng cũ là yêu cầu nghiệp vụ thật.
- Swagger và guide phải dùng cùng một contract.

## Priority

1. Protect/restore `admin@system.local`.
2. Seed/fix class section + enrollment data.
3. Upload material async/status.
4. Quiz generation timeout/error contract.
5. Fix course alias/canonical `courseId` mismatch (`OSG` vs `OSG202`) for RAG.
6. Conversation course scope + pin persistence.
7. Fix mojibake/UTF-8 error messages for AI/LLM failures.
8. Standard error response.
9. Fix PDF chunking logic for Markdown documents to restore AI answering capabilities.
10. Reject quiz generation when retrieval has no course/topic-relevant chunks.
11. Align Tutor V2 evaluation guide fields with `StartEvalRunRequest`.
