# Mô hình Use Case nghiệp vụ — AI Tutor Platform

File sơ đồ có thể mở trực tiếp bằng diagrams.net/draw.io:

- `docs/AI_Tutor_Use_Case.drawio`
- Đặc tả feature chi tiết: `docs/AI_TUTOR_FEATURE_SPECIFICATION_VI.md`

Sơ đồ gồm 5 trang. Trang đầu là bản core đầy đủ để trình bày/bảo vệ; các trang sau dùng để phân rã và thuyết minh:

1. `00 - Core AI Tutor`: 6 actor, 30 use case và toàn bộ quan hệ nghiệp vụ cốt lõi.
2. `01 - Tổng quan nghiệp vụ`: bản tóm tắt cấp cao.
3. `02 - Phiên học AI Tutor`: RAG, cá nhân hóa và các nhánh mở rộng của phiên học.
4. `03 - Cải tiến tri thức AI`: human-in-the-loop và knowledge approval.
5. `04 - Đánh giá học tập`: quiz, bài tập và chấm bài.

## 1. Use case là gì?

Use case mô tả **một mục tiêu có giá trị mà actor đạt được khi tương tác với hệ thống**. Use case không phải một màn hình, endpoint, bảng dữ liệu hay hàm kỹ thuật. Vì vậy sơ đồ này chủ động bỏ các mục kiểu “quản lý user”, “CRUD course”, “xem dashboard” khi chúng không phải mục tiêu nghiệp vụ trung tâm của AI Tutor.

Theo UML:

- Actor là một vai trò bên ngoài system boundary, không nhất thiết là một người cụ thể.
- Use case nằm bên trong boundary; actor nằm bên ngoài.
- Association là đường liền giữa actor và use case mà actor tham gia.
- `«include»` dùng khi use case nền **luôn cần** thực hiện một hành vi dùng lại. Mũi tên đi từ use case nền tới use case được include.
- `«extend»` dùng cho hành vi **tùy điều kiện hoặc tùy chọn**. Mũi tên đi từ use case mở rộng về use case nền.
- Generalization dùng khi actor chuyên biệt thừa hưởng toàn bộ quan hệ của actor tổng quát.

Nguồn tham khảo:

- [OMG UML 2.5.1 — chương 18 Use Cases](https://www.omg.org/spec/UML/2.5.1/PDF)
- [OMG UML 2.5.1 specification page](https://www.omg.org/spec/UML/2.5.1/About-UML)
- [IBM — system boundary và mục đích của use-case diagram](https://www.ibm.com/docs/en/dma?topic=diagrams-creating-use-case)
- [Microsoft — actor, association, include, extend và generalization](https://support.microsoft.com/en-us/visio/create-a-uml-use-case-diagram)

## 2. Cách hiểu 6 actor trong project

| Actor | Vai trò nghiệp vụ trong sơ đồ |
|---|---|
| Student | Học với AI Tutor, luyện tập, đánh giá câu trả lời và yêu cầu hỗ trợ con người. |
| Teacher | Theo dõi quá trình học, đưa chỉ dẫn sư phạm, hỗ trợ sinh viên, thiết kế đánh giá và đóng góp tri thức chuyên môn. |
| Senior | Actor chuyên biệt của Teacher; có thêm quyền thẩm định tri thức, duyệt knowledge candidate và đánh giá chất lượng AI Tutor. |
| Admin | Đại diện nhà trường thiết lập syllabus/học liệu chuẩn và có thể tham gia cổng phê duyệt tri thức. Không biểu diễn CRUD tài khoản trong sơ đồ nghiệp vụ chính. |
| System Handler | n8n/orchestrator bên ngoài AI Tutor Platform, điều phối webhook, nhánh RAG/CODE/ESCALATE, hàng chờ review và lỗi/fallback. |
| AI | Dịch vụ AI/LLM bên ngoài, hỗ trợ phân loại ý định, sinh phản hồi grounded, sinh quiz và chạy evaluation. |

Lưu ý quan trọng: nếu phạm vi hệ thống được mở rộng để bao gồm cả n8n và model AI, hai thành phần này trở thành **thành phần nội bộ**, không còn là actor. Sơ đồ hiện tại coi boundary là sản phẩm AI Tutor Web/API và coi n8n cùng AI provider là external supporting actors, phù hợp với yêu cầu 6 actor.

`Senior —▷ Teacher` là actor generalization vì code và tài liệu nghiệp vụ xác định Senior có toàn bộ quyền Teacher cộng thêm quyền kiểm duyệt.

## 3. Các use case nghiệp vụ chính

### Student

- Học cùng AI Tutor.
- Học với Code Mentor khi câu hỏi có code.
- Làm kiểm tra hiểu, quiz tự luyện hoặc quiz được giao.
- Nộp bài tập.
- Nghe câu trả lời bằng TTS khi cần.
- Đánh giá/báo lỗi câu trả lời AI.
- Chuyển sang hỗ trợ giảng viên khi AI thiếu tự tin hoặc sinh viên yêu cầu.

### Teacher

- Theo dõi tiến độ và điều chỉnh cách dạy cho sinh viên trong môn.
- Cập nhật chỉ dẫn sư phạm áp dụng cho sinh viên/môn học.
- Xử lý phản hồi và hỗ trợ sinh viên.
- Thiết kế, giao và đánh giá quiz/bài tập.
- Đề xuất tri thức học thuật có thể tái sử dụng.
- Đóng góp Gold Q&A/rubric theo nhiệm vụ chuyên gia.

### Senior

- Thẩm định phản hồi nghiêm trọng và knowledge candidate.
- Kiểm chứng nội dung với học liệu chuẩn.
- Phê duyệt hoặc từ chối tri thức ứng viên.
- Công bố tri thức đã duyệt vào RAG.
- Đánh giá chất lượng AI Tutor bằng holdout/evaluation.

### Admin

- Thiết lập syllabus và học liệu chuẩn của môn.
- Kích hoạt xử lý, phân đoạn và lập chỉ mục học liệu.
- Tham gia phê duyệt tri thức như cổng dự phòng theo nghiệp vụ hiện tại.

## 4. Vì sao các quan hệ include/extend được dùng như vậy?

| Quan hệ | Lý do |
|---|---|
| Học một chủ đề `include` Điều phối phiên học | Mọi lượt học đều phải được định tuyến và theo dõi phiên. |
| Học một chủ đề `include` Truy xuất học liệu | Câu trả lời học thuật phải grounded trên dữ liệu môn học. |
| Học một chủ đề `include` Áp dụng hồ sơ/chỉ dẫn | Đây là phần tạo khác biệt gia sư: nội dung nguồn chung nhưng cách dạy được cá nhân hóa. |
| Học một chủ đề `include` Sinh phản hồi có trích dẫn | Đây là kết quả bắt buộc của lượt học RAG. |
| Code Mentor `extend` Học một chủ đề | Chỉ xảy ra khi câu hỏi/code snippet cần nhánh CODE. |
| Hỗ trợ giảng viên `extend` Học một chủ đề | Chỉ xảy ra khi confidence thấp hoặc sinh viên chủ động yêu cầu. |
| TTS `extend` Học một chủ đề | Chỉ chạy khi sinh viên chọn nghe. |
| Đề xuất tri thức `extend` Xử lý phản hồi | Không phải mọi câu trả lời của Teacher đều là tri thức học thuật tái sử dụng. |
| Công bố tri thức `extend` Thẩm định ứng viên | Chỉ chạy khi quyết định là APPROVE; REJECT không index. |
| Thẩm định ứng viên `include` Kiểm chứng nguồn và Quyết định | Hai bước này bắt buộc đối với mọi candidate. |
| AI gợi ý chấm `extend` Giao/chấm bài | AI chỉ hỗ trợ khi Teacher yêu cầu; Teacher chịu trách nhiệm điểm cuối. |

## 5. Đặc tả ngắn các use case quan trọng

### UC-01 — Học một chủ đề với AI Tutor

- Actor chính: Student.
- Actor hỗ trợ: System Handler, AI; Teacher cung cấp chỉ dẫn sư phạm trước đó.
- Tiền điều kiện: Student thuộc môn/lớp; môn có học liệu đã index.
- Luồng chính: gửi mục tiêu/câu hỏi → phân loại ý định → truy xuất child chunk và mở parent section → áp dụng learner memory/chỉ dẫn Teacher → sinh câu trả lời có bằng chứng → kiểm tra tính đầy đủ → lưu tiến độ.
- Mở rộng: Code Mentor; kiểm tra hiểu; TTS; escalation sang Teacher.
- Hậu điều kiện: câu trả lời và bằng chứng được lưu trong conversation; learner memory được cập nhật.

### UC-02 — Chuyển sang hỗ trợ giảng viên

- Actor chính: Student.
- Actor hỗ trợ: Teacher, System Handler.
- Điều kiện kích hoạt: AI confidence thấp, thiếu tài liệu, sinh viên báo sai hoặc yêu cầu con người.
- Luồng chính: tạo escalation → tìm/đề xuất Teacher phù hợp → Student chọn Teacher → tạo phòng chat → Teacher giải đáp → đóng yêu cầu.
- Mở rộng: Teacher đề xuất knowledge candidate nếu câu trả lời là tri thức học thuật tái sử dụng.

### UC-03 — Thẩm định và cải tiến tri thức AI

- Actor chính: Senior; Admin là actor dự phòng ở cổng approval.
- Actor hỗ trợ: Teacher, System Handler, AI.
- Tiền điều kiện: có answer review nghiêm trọng, teacher answer hoặc expert contribution.
- Luồng chính: kiểm tra nội dung và nguồn → sửa/chuẩn hóa → approve hoặc reject → nếu approve thì index tri thức → AI Tutor sử dụng ở các lượt sau.
- Quy tắc: feedback thô của Student không được index trực tiếp; evaluation holdout không được đưa vào RAG.

### UC-04 — Luyện tập và đánh giá học tập

- Actor chính: Student hoặc Teacher tùy nhánh.
- Actor hỗ trợ: System Handler, AI.
- Luồng Student tự luyện: chọn chủ đề → sinh quiz grounded → làm bài → chấm và giải thích → cập nhật mức thành thạo.
- Luồng Teacher giao quiz: sinh/chỉnh draft → publish → Student làm → auto-score → Teacher review → final score.
- Luồng bài tập: Teacher giao đề → Student nộp → Teacher chấm; AI grading chỉ là nhánh hỗ trợ tùy chọn.

## 6. Căn cứ từ project

- Route theo vai trò: `Ai_Turtor_FE/src/app/routes.js`.
- AI/RAG/Code/Escalation: `AI_Turtor_BE/src/main/java/com/ragapi/controller/TutorController.java`, `CodeMentorController.java`, `EscalationController.java`.
- Theo dõi và cá nhân hóa: `TutorSessionController.java`, `StudentMemoryController.java`, `PedagogicalDirectiveService.java`.
- Quiz và bài tập: `QuizController.java`, `AssignmentController.java`.
- Human learning: `AiAnswerReviewController.java`, `KnowledgeCandidateController.java`, `HumanLearningService.java`.
- Expert co-training/evaluation: `ExpertCoTrainingController.java` và package `service/cotraining`.
- Điều phối n8n: `AI_Turtor_BE/n8n-import/AI-tutor-workflow-runtime-fixed.json`.

## 7. Những nội dung cố ý không đưa vào sơ đồ chính

- Đăng nhập, đổi mật khẩu, CRUD user/semester/class.
- Xem dashboard, filter, phân trang, tải danh sách.
- MongoDB, Elasticsearch, Redis, WebSocket, REST endpoint cụ thể.
- Cấu hình provider, token, timeout và health check.

Các nội dung này quan trọng ở thiết kế hệ thống hoặc deployment nhưng không phải mục tiêu nghiệp vụ cốt lõi của actor trong Use Case model.
