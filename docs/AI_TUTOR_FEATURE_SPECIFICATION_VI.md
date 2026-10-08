# ĐẶC TẢ FEATURE NGHIỆP VỤ CHÍNH — AI TUTOR PLATFORM

## 1. Mục đích và phạm vi

Tài liệu này đặc tả các feature tạo nên giá trị cốt lõi của AI Tutor: dạy học có căn cứ, cá nhân hóa cách dạy, đánh giá quá trình học và cải tiến tri thức dưới sự kiểm soát của con người.

Tài liệu không xem các thao tác CRUD tài khoản, phân trang, lọc danh sách hay cấu hình hạ tầng là feature nghiệp vụ chính. Các chức năng đó là năng lực hỗ trợ của hệ thống.

Sơ đồ Use Case liên quan: `docs/AI_Tutor_Use_Case.drawio`.

### 1.1 Actor

| Actor | Trách nhiệm chính |
|---|---|
| Student | Học, luyện tập, nộp bài, phản hồi câu trả lời và yêu cầu hỗ trợ con người. |
| Teacher | Hướng dẫn sư phạm, theo dõi học tập, giao/chấm bài và giải đáp escalation. |
| Senior | Kế thừa vai trò Teacher; thẩm định tri thức và đánh giá chất lượng AI. |
| Admin | Đại diện nhà trường công bố syllabus, học liệu chuẩn và quản trị phạm vi môn học. |
| System Handler | n8n/orchestrator điều phối nhánh RAG, CODE, ESCALATE, retry và theo dõi lỗi. |
| AI | Model/provider thực hiện phân loại, sinh nội dung, tạo quiz và hỗ trợ đánh giá. |

### 1.2 Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| Đã triển khai | Có luồng BE/FE hoặc API nghiệp vụ trong code hiện tại. |
| Một phần | Có nền tảng nhưng chưa hoàn thiện toàn bộ trải nghiệm hoặc tự động hóa. |
| Chưa triển khai | Chỉ là định hướng, không được coi là chức năng hiện hữu. |

## 2. Danh mục feature chính

| ID | Feature | Actor chính | Trạng thái |
|---|---|---|---|
| F-01 | Phiên học với AI Tutor có căn cứ | Student | Đã triển khai |
| F-02 | Cá nhân hóa cách dạy theo từng sinh viên | Student, Teacher | Đã triển khai |
| F-03 | Hybrid Parent–Child Retrieval và bằng chứng | System Handler, AI | Đã triển khai |
| F-04 | Code Mentor | Student | Đã triển khai |
| F-05 | Kiểm tra hiểu và quiz thích ứng | Student, Teacher | Đã triển khai |
| F-06 | Bài tập, bài nộp và chấm bài | Student, Teacher | Đã triển khai |
| F-07 | Chuyển giao sang giảng viên và chat trực tiếp | Student, Teacher | Đã triển khai |
| F-08 | Phản hồi câu trả lời và vòng lặp cải tiến tri thức | Student, Teacher, Senior | Đã triển khai |
| F-09 | Expert co-training và đánh giá AI bằng holdout | Teacher, Senior | Đã triển khai |
| F-10 | Quản trị syllabus và học liệu chuẩn | Admin, Teacher | Đã triển khai |
| F-11 | Hội thoại đa phương thức | Student | Một phần: Text + TTS; chưa có STT hội thoại |
| F-12 | Điều phối AI, failover và quan sát vận hành | System Handler | Đã triển khai ở mức nền tảng |

---

## 3. Đặc tả chi tiết

## F-01 — Phiên học với AI Tutor có căn cứ

**Mục tiêu:** Student có thể yêu cầu giải thích một khái niệm hoặc bắt đầu học một bài; AI tổ chức nội dung như gia sư và chỉ dùng tri thức phù hợp với môn học.

**Actor chính:** Student.  
**Actor hỗ trợ:** System Handler, AI.  
**Feature liên quan:** F-02, F-03, F-05, F-07, F-11.

### Tiền điều kiện

- Student đã đăng nhập, thuộc lớp/môn hợp lệ và chọn môn đang học.
- Môn học có học liệu ở trạng thái có thể truy xuất.
- Student chưa vượt quota ngày và quota của conversation.

### Kích hoạt

Student gửi câu hỏi, ví dụ “tính đa hình là gì?”, hoặc mục tiêu học, ví dụ “hôm nay tôi muốn học tính đa hình”.

### Luồng chính

1. Hệ thống xác thực Student, course, class và conversation.
2. Hệ thống phân loại ý định: hỏi khái niệm, bắt đầu bài học, học chuyên sâu, code hoặc cần con người hỗ trợ.
3. Với câu hỏi học thuật, hệ thống truy xuất học liệu theo F-03.
4. Hệ thống nạp hồ sơ học tập và chỉ dẫn sư phạm theo F-02.
5. AI sinh câu trả lời theo đúng loại bài học:
   - giải thích khái niệm;
   - bài dạy có trình tự;
   - lộ trình học sâu;
   - hướng dẫn thực hành.
6. Hệ thống kiểm tra câu trả lời có đủ nội dung, bằng chứng và cấu trúc cần thiết; retry/fallback khi cần.
7. FE hiển thị câu trả lời, trích dẫn, thao tác nghe, phản hồi và gửi mentor xem xét.
8. Hệ thống lưu lượt chat, usage, tiến độ và dữ liệu cần thiết cho learner memory.

### Luồng thay thế/ngoại lệ

- Không tìm đủ bằng chứng: không bịa câu trả lời; thông báo giới hạn và đề nghị hỗ trợ Teacher.
- Ý định là CODE: chuyển sang F-04.
- Student yêu cầu người thật hoặc confidence thấp: mở F-07.
- Provider lỗi/timeout: System Handler thử provider/fallback được cấu hình; vẫn lỗi thì trả thông báo rõ ràng.
- Vượt quota: từ chối lượt mới nhưng không làm mất lịch sử hiện có.

### Quy tắc nghiệp vụ

- Trả lời học thuật phải grounded theo học liệu trong phạm vi môn/lớp được phép.
- “Học một chủ đề” không được xử lý như truy vấn định nghĩa đơn lẻ; phải tạo bài dạy có mục tiêu, giải thích, ví dụ/thực hành và kiểm tra hiểu phù hợp.
- Tài liệu được truy xuất trên toàn bộ kho hợp lệ của môn; cá nhân hóa nằm ở cách dạy, không phải thu hẹp kiến thức theo năng lực Student.
- Quota mặc định hiện tại: 10 câu hỏi/ngày cho mỗi Student–course và tối đa 10 câu hỏi của Student trong một conversation.
- Câu hỏi tối đa 4.000 ký tự.

### Kết quả

- Conversation/message được lưu.
- Câu trả lời có evidence metadata khi là RAG answer.
- Usage/audit có trạng thái thành công hoặc lỗi rõ ràng.

### Acceptance criteria

- Khi hỏi cùng một kiến thức, hai Student phải nhận nội dung đúng cùng nguồn nhưng cách trình bày có thể khác theo hồ sơ học tập.
- Khi gửi câu “hôm nay tôi muốn học X”, hệ thống phải nhận ra X là chủ đề học và không từ chối chỉ vì câu có từ ngữ dẫn nhập.
- Không được hiển thị trạng thái “hoàn tất” nếu AI/provider không tạo được câu trả lời hữu dụng.
- Evidence mở trên FE phải khớp với tài liệu, chương/section và đoạn nội dung được dùng.

## F-02 — Cá nhân hóa cách dạy theo từng sinh viên

**Mục tiêu:** Cùng một syllabus và kho học liệu, AI thay đổi mức giàn giáo, độ sâu, ví dụ và hoạt động kiểm tra theo nhu cầu của từng Student.

**Actor chính:** Student, Teacher.  
**Actor hỗ trợ:** AI.

### Dữ liệu đầu vào

- Learner memory theo Student và course: chủ đề đã học, điểm mạnh/yếu, lỗi thường gặp và tiến độ.
- Chỉ dẫn sư phạm do Teacher xác nhận.
- Mức hỗ trợ: `HIGH_SUPPORT`, `STANDARD`, `CHALLENGE`.
- Ngữ cảnh conversation hiện tại.

### Luồng chính

1. Teacher chọn lớp và Student, hoặc thiết lập chỉ dẫn dùng chung cho lớp/môn.
2. Teacher nhập nhận xét/chỉ dẫn và chọn mức hỗ trợ.
3. Chỉ dẫn đi qua trạng thái draft → confirmed → archived.
4. Khi Student học, hệ thống lấy tối đa các chỉ dẫn confirmed còn hiệu lực, sắp theo mức ưu tiên.
5. Chỉ dẫn riêng của Student được ưu tiên hơn chỉ dẫn cấp lớp.
6. AI kết hợp learner memory và chỉ dẫn để điều chỉnh cách dạy, nhưng không thay đổi sự thật học thuật từ nguồn.
7. Kết quả quiz và tương tác mới tiếp tục cập nhật memory cho các lượt sau.

### Quy tắc nghiệp vụ

- Teacher kiểm soát support level; hệ thống không tự đổi level chỉ vì một lỗi quiz hay một đoạn memory.
- Priority hợp lệ từ 0 đến 100; mặc định 50.
- Chỉ chỉ dẫn `CONFIRMED` và còn trong khoảng hiệu lực mới được áp dụng.
- Chỉ dẫn cấp Student ghi đè/chuyên biệt hóa chỉ dẫn cấp lớp khi xung đột.
- Chỉ dẫn áp dụng cho Student trong môn học; không bắt buộc Teacher nhập từng “chủ đề áp dụng”.
- Personalization được phép đổi cách giải thích, nhịp độ, số ví dụ, hint và độ khó; không được làm sai nội dung chuẩn.

### Acceptance criteria

- Hai Student có cùng `STANDARD` nhưng memory khác nhau có thể nhận ví dụ/kiểm tra hiểu khác nhau; cả hai vẫn phải bao phủ mục tiêu bài học tối thiểu.
- Cùng một Student, chỉ dẫn confirmed mới phải có hiệu lực ở lượt học tiếp theo của đúng course.
- Chỉ dẫn draft/expired/archived không được đưa vào prompt.
- Không dùng dữ liệu cá nhân của Student A để cá nhân hóa câu trả lời cho Student B.

## F-03 — Hybrid Parent–Child Retrieval và bằng chứng

**Mục tiêu:** Tìm đúng đoạn nhỏ để xếp hạng nhưng cung cấp đủ section cha để AI hiểu ngữ cảnh, đồng thời tạo trích dẫn có thể kiểm chứng.

**Actor khởi tạo gián tiếp:** Student.  
**Actor hỗ trợ:** System Handler, AI.

### Cấu trúc dữ liệu

`document → chapter → section → chunk`

- `chunk` là child nhỏ, phù hợp cho vector/keyword matching.
- `section` là parent chứa ngữ cảnh đầy đủ hơn cho generation.
- Citation giữ material, chapter, section, page/chunk ID và node type khi có.

### Luồng chính

1. Chuẩn hóa truy vấn và các thuật ngữ môn học.
2. Tìm candidate song song bằng:
   - vector similarity;
   - Elasticsearch keyword/BM25;
   - Mongo text/lexical fallback;
   - approved teaching note khi phù hợp.
3. Hợp nhất và loại trùng candidate.
4. Xếp hạng theo độ liên quan và coverage thuật ngữ; scale BM25 bằng `log1p` để điểm keyword không lấn át vector.
5. Loại nội dung điều hướng không có giá trị chứng minh như Contents, Table of Contents và Index.
6. Từ child chunk tốt nhất, mở rộng lên parent section.
7. Chọn tối đa 6 parent section và cắt theo context budget nhưng giữ metadata nguồn.
8. Chuyển context cho AI; trả evidence tương ứng về FE.

### Quy tắc nghiệp vụ

- Search chạy trên toàn bộ học liệu mà Student được quyền dùng trong course; không filter theo “học giỏi/học yếu”.
- Học liệu `COURSE_SHARED` là nguồn dùng chung của trường; `CLASS_SECTION` chỉ dùng trong lớp tương ứng.
- Rerank bằng dịch vụ ngoài đang tắt mặc định; pipeline vẫn hybrid và dùng ranking nội bộ.
- Approved knowledge có thể tham gia retrieval; candidate chưa duyệt và evaluation holdout không được đưa vào RAG.
- Mongo fallback không được tự bịa `chapterTitle` hoặc `sectionTitle`; thiếu metadata phải trả null/không xác định.
- Một dòng trích dẫn chỉ hợp lệ khi đoạn evidence thực sự hỗ trợ claim; số lượng citation không quan trọng bằng độ đúng và khả năng kiểm chứng.

### Acceptance criteria

- Query về lifecycle không được bị đoạn Contents có nhiều keyword xếp trên nội dung giải thích lifecycle.
- Evidence hiển thị phải tồn tại trong material gốc và truy ngược được tới material/chapter/section/page hoặc chunk.
- Khi chỉ có child hit ngắn, generation context phải nhận parent section nếu section tồn tại.
- Việc cắt context không được làm mất định danh nguồn.

## F-04 — Code Mentor

**Mục tiêu:** Hỗ trợ Student hiểu, sửa và cải thiện code mà không biến thành công cụ làm hộ bài tập thiếu kiểm soát.

**Actor chính:** Student.  
**Actor hỗ trợ:** System Handler, AI.

### Luồng chính

1. Student gửi câu hỏi và code snippet hoặc hệ thống nhận diện intent CODE.
2. Hệ thống kiểm tra độ dài, ngôn ngữ/framework và việc có liên quan assignment hay không.
3. AI phân tích lỗi, giải thích nguyên nhân và đề xuất cách sửa theo mức hỗ trợ của Student.
4. Với yêu cầu học tập, AI ưu tiên hint và giải thích trước đáp án hoàn chỉnh.
5. Kết quả được lưu vào conversation và có thể được Student phản hồi/escalate.

### Quy tắc nghiệp vụ

- Code tối đa 12.000 ký tự và 100 dòng theo validation hiện tại.
- Nếu câu hỏi phụ thuộc quy định/tài liệu môn, Code Mentor phải dùng context course hoặc nói rõ giới hạn.
- Với assignment, AI không được mặc định thay Teacher ra quyết định điểm cuối.

### Acceptance criteria

- Câu trả lời phải chỉ ra vị trí/loại lỗi, nguyên nhân và bước sửa có thể hành động.
- Code không hợp lệ hoặc quá giới hạn phải nhận lỗi validation rõ ràng.
- Nhánh CODE không được làm tăng quota nhiều lần do retry nội bộ của cùng request.

## F-05 — Kiểm tra hiểu và quiz thích ứng

**Mục tiêu:** Đo việc Student thật sự hiểu bài, cung cấp feedback và dùng kết quả để điều chỉnh các lượt dạy tiếp theo.

**Actor chính:** Student, Teacher.  
**Actor hỗ trợ:** AI, System Handler.

### Các biến thể

1. **Understanding check trong câu trả lời:** câu hỏi ngắn xuất hiện sau bài dạy.
2. **Quiz tự luyện:** Student yêu cầu hệ thống tạo quiz theo course/chủ đề.
3. **Quiz được giao:** Teacher tạo thủ công hoặc nhờ AI tạo draft, chỉnh sửa rồi publish.

### Luồng chính — understanding check

1. AI tạo câu hỏi và các lựa chọn ở payload có cấu trúc.
2. FE chỉ hiển thị câu hỏi/lựa chọn; chưa lộ đáp án và giải thích.
3. Student chọn đáp án.
4. Hệ thống chấm, sau đó mới hiển thị đáp án đúng và giải thích.
5. Kết quả được lưu làm tín hiệu học tập.

### Luồng chính — quiz được giao

1. Teacher tạo quiz thủ công hoặc sinh draft bằng AI.
2. Teacher chỉnh sửa và publish.
3. Student làm và nộp attempt.
4. Hệ thống auto-score phần có đáp án xác định.
5. Teacher review khi cần và xác nhận kết quả cuối.

### Quy tắc nghiệp vụ

- Mọi bài dạy cùng loại và cùng chính sách phải có behavior kiểm tra hiểu nhất quán; không phụ thuộc ngẫu nhiên hoàn toàn vào model.
- Đáp án/giải thích phải nằm trong structured payload và chỉ reveal sau lựa chọn hoặc khi Teacher cho phép.
- Quiz grounded phải dựa trên nội dung course, không sinh câu ngoài phạm vi chỉ để đủ số lượng.
- AI hỗ trợ tạo/chấm; Teacher chịu trách nhiệm với đánh giá chính thức.

### Acceptance criteria

- Không được để đáp án đúng xuất hiện trong nội dung câu hỏi hoặc option trước khi Student chọn.
- Hai Student cùng policy có thể nhận câu khác nhau nhưng phải có độ khó và mục tiêu tương đương.
- Sau submit phải lưu score, đáp án Student, feedback và thời điểm nộp.
- Quiz draft chưa publish không được xuất hiện trong danh sách cần làm của Student.

## F-06 — Bài tập, bài nộp và chấm bài

**Mục tiêu:** Teacher giao nhiệm vụ học tập; Student nộp sản phẩm; Teacher đánh giá, có thể dùng AI làm trợ lý.

**Actor chính:** Teacher, Student.  
**Actor hỗ trợ:** AI.

### Luồng chính

1. Teacher tạo assignment cho course/class, mô tả yêu cầu và tải file đề.
2. Teacher có thể tải answer key/rubric nội bộ.
3. Student xem assignment và nộp file trước điều kiện cho phép.
4. Hệ thống lưu submission gắn đúng Student và assignment.
5. Teacher xem bài nộp, nhập nhận xét/điểm và hoàn tất review.
6. Tùy chọn: Teacher yêu cầu AI tạo gợi ý chấm dựa trên đề và answer key.

### Quy tắc nghiệp vụ

- AI-grade là gợi ý; không tự động trở thành điểm cuối nếu Teacher chưa xác nhận.
- Student chỉ xem được assignment thuộc lớp/môn của mình.
- Teacher chỉ chấm assignment thuộc phạm vi được phân công.
- File đề, answer key và submission phải có access control khác nhau.

### Acceptance criteria

- Answer key không được trả qua endpoint dành cho Student.
- Mỗi submission truy ngược được Student, assignment, file, thời gian và trạng thái review.
- Chạy AI-grade thất bại không được làm mất bài nộp hoặc ghi đè điểm Teacher.

## F-07 — Chuyển giao sang giảng viên và chat trực tiếp

**Mục tiêu:** Không ép AI trả lời khi thiếu bằng chứng hoặc Student cần con người; bảo toàn ngữ cảnh để Teacher hỗ trợ hiệu quả.

**Actor chính:** Student, Teacher.  
**Actor hỗ trợ:** System Handler.

### Điều kiện kích hoạt

- Student chủ động chọn “Gửi mentor xem xét”.
- AI thiếu tài liệu/độ tin cậy thấp.
- Student báo câu trả lời sai hoặc vấn đề cần quyết định của giảng viên.

### Luồng chính

1. Hệ thống tạo escalation kèm course, class, Student, câu hỏi, câu trả lời AI và evidence liên quan.
2. Hệ thống gợi ý hoặc hiển thị Teacher phù hợp; Student có thể chọn theo flow hiện tại.
3. Teacher nhận yêu cầu trong hàng chờ hỗ trợ.
4. Student và Teacher trao đổi qua kênh chat.
5. Teacher trả lời và đóng yêu cầu.
6. Nếu câu trả lời chứa tri thức học thuật tái sử dụng, Teacher có thể tạo knowledge candidate cho F-08.

### Quy tắc nghiệp vụ

- Operational policy, grading decision, class rule và nội dung assignment-specific không được mặc định đưa vào “AI brain”.
- Escalation phải giữ ngữ cảnh gốc; Student không phải nhập lại toàn bộ câu hỏi.
- Chỉ Teacher được phân công/phù hợp phạm vi mới xem dữ liệu Student liên quan.

### Acceptance criteria

- Escalation mới phải xuất hiện ở Teacher queue đúng course/class.
- Tin nhắn realtime phải gắn đúng room/participants và không rò sang Student khác.
- Đóng escalation không xóa lịch sử trao đổi.

## F-08 — Phản hồi câu trả lời và vòng lặp cải tiến tri thức

**Mục tiêu:** Biến phản hồi chất lượng thành tri thức có kiểm duyệt, không cho AI tự học trực tiếp từ feedback chưa xác minh.

**Actor chính:** Student, Teacher, Senior.  
**Actor hỗ trợ:** Admin, System Handler.

### Nguồn tạo review/candidate

- Student đánh giá sao, báo lỗi hoặc phản ánh xung đột nguồn.
- Teacher trả lời escalation và đánh dấu là kiến thức học thuật có thể tái sử dụng.
- Senior xử lý review nghiêm trọng và viết nội dung sửa đúng.

### Luồng chính

1. Hệ thống lưu feedback cùng AI answer, course và evidence tại thời điểm trả lời.
2. Feedback được phân tầng/routing: thông thường, moderate, severe hoặc source conflict.
3. Teacher/Senior xem nhóm review và kiểm tra nội dung.
4. Nếu cần học tri thức mới, hệ thống tạo `KnowledgeCandidate` ở trạng thái chờ duyệt.
5. Senior hoặc Admin hợp lệ kiểm chứng nguồn, sửa nội dung nếu cần và approve/reject.
6. Chỉ candidate approved mới được index vào RAG.
7. Candidate rejected được lưu audit nhưng không tham gia retrieval.

### Quy tắc nghiệp vụ

- Student feedback không bao giờ được index trực tiếp.
- Người tạo/Teacher trả lời ban đầu không được tự phê duyệt candidate của chính mình.
- Chỉ `SENIOR_MENTOR` hoặc `ADMIN` có quyền approve/reject theo flow hiện tại.
- Tri thức phải được phân loại; chỉ academic knowledge, material correction hoặc FAQ clarification phù hợp mới có thể index.
- Ảnh minh họa knowledge tối đa 6 ảnh, mỗi ảnh tối đa 5 MB theo validation hiện tại.

### Acceptance criteria

- Candidate pending không xuất hiện trong kết quả RAG.
- Sau approve và index thành công, truy vấn phù hợp có thể lấy candidate như một nguồn đã duyệt.
- Reject phải lưu reviewer, lý do và thời gian.
- Audit phải truy ra feedback gốc, candidate, người duyệt và phiên bản nội dung được index.

## F-09 — Expert co-training và đánh giá AI bằng holdout

**Mục tiêu:** Chủ động tìm lỗ hổng tri thức, huy động chuyên gia tạo dữ liệu chuẩn và đo chất lượng AI mà không làm ô nhiễm tập đánh giá.

**Actor chính:** Teacher, Senior.  
**Actor hỗ trợ:** AI, System Handler.

### Luồng chính

1. Hệ thống lấy/sinh chapter outline từ tài liệu; Senior xác nhận hoặc nhập thủ công.
2. Hệ thống phân tích coverage và tạo coverage gap.
3. Senior tạo/assign expert task cho Teacher.
4. Teacher đóng góp Gold Q&A hoặc rubric.
5. Gold Q&A/rubric được gửi review và Senior approve/reject.
6. Dữ liệu `TRAINING` đã duyệt có thể bổ sung năng lực trả lời/RAG.
7. Dữ liệu `EVALUATION` được giữ làm holdout.
8. Senior chạy eval, xem kết quả và so sánh chất lượng theo rubric.

### Quy tắc nghiệp vụ

- Evaluation holdout tuyệt đối không được index vào RAG hoặc đưa vào prompt trả lời trước khi đánh giá.
- Gold Q&A phải gắn course/chapter/topic và có đáp án chuẩn kiểm chứng được.
- Kết quả eval không tự động thay đổi tri thức production; thay đổi phải đi qua approval/indexing.

### Acceptance criteria

- Coverage gap phải truy ra chapter và lý do thiếu coverage.
- Gold Q&A chưa duyệt không được dùng cho production answer.
- Eval run lưu bộ dữ liệu, model/config, thời gian và kết quả để so sánh lại.

## F-10 — Quản trị syllabus và học liệu chuẩn

**Mục tiêu:** Nhà trường quyết định nội dung chính thức của môn; AI không tự suy đoán chương trình học chỉ từ các đoạn tài liệu rời rạc.

**Actor chính:** Admin.  
**Actor phụ:** Teacher.

### Luồng Admin — học liệu dùng chung

1. Admin chọn course và upload PDF/DOCX/PPT hoặc import HTML URL.
2. Admin bắt buộc cung cấp syllabus/description chính thức khi tạo nguồn `COURSE_SHARED` theo nghiệp vụ UI/API.
3. Hệ thống lưu syllabus vào course (`Course.description`; hệ thống còn có trường syllabus tiếng Việt).
4. Hệ thống lưu file, trích xuất text, nhận diện cấu trúc, chunk và tạo index bất đồng bộ.
5. Material chuyển `PROCESSING` → `INDEXED`, hoặc `FAILED` kèm thông tin lỗi.
6. Tutor dùng syllabus cho “nội dung chính trong chương trình học” và dùng material đã index cho câu trả lời chi tiết.

### Luồng Teacher — học liệu lớp

1. Teacher upload material cho class được phân công.
2. Material được gắn scope `CLASS_SECTION`.
3. Sau khi index, chỉ Student đúng class/course được dùng nguồn này.

### Quy tắc nghiệp vụ

- `COURSE_SHARED` là tri thức chuẩn dùng cho toàn course; `CLASS_SECTION` bổ sung cho một lớp.
- Chỉ material index thành công mới nên tham gia retrieval production.
- Syllabus là mô tả chương trình do nhà trường chịu trách nhiệm, không phải văn bản AI tự sinh.
- Xóa/reindex material phải đồng bộ document, chunk và search index để tránh citation mồ côi.

### Acceptance criteria

- Admin upload nguồn dùng chung mà thiếu syllabus bắt buộc phải được FE/API yêu cầu bổ sung theo policy.
- “Nội dung chính trong chương trình học” phải ưu tiên syllabus đã lưu; fallback chapter title chỉ dành cho course cũ chưa có syllabus.
- Student lớp A không thấy material `CLASS_SECTION` của lớp B.
- Material lỗi indexing phải có thể retry mà không tạo bản sao chunk lặp.

## F-11 — Hội thoại đa phương thức

**Mục tiêu:** Cho phép Student học bằng text và âm thanh với trải nghiệm gần hội thoại tự nhiên.

### Phạm vi hiện tại

- **Đã có:** nhập text; AI trả text; chọn giọng và đọc câu trả lời bằng TTS/NVIDIA Magpie.
- **Chưa có đầy đủ:** microphone → streaming audio → speech-to-text → phát hiện lượt nói → gửi Tutor → phát giọng đáp liên tục như Google Meet.

### Luồng TTS hiện tại

1. Student chọn “Đọc” và voice.
2. FE gửi nội dung/voice tới TTS endpoint.
3. Provider sinh audio.
4. FE phát, tạm dừng hoặc dừng audio.

### Luồng voice hội thoại mục tiêu

1. Trình duyệt xin quyền microphone.
2. FE thu/stream audio và hiển thị trạng thái đang nghe.
3. STT tạo transcript tạm thời và transcript cuối.
4. Student xác nhận hoặc hệ thống tự gửi khi phát hiện kết thúc lượt nói.
5. Transcript đi qua F-01 như một câu hỏi text thông thường.
6. Câu trả lời được stream về và TTS phát; Student có thể ngắt lời.

### Acceptance criteria hiện tại

- TTS lỗi không được làm mất câu trả lời text.
- Không mô tả sản phẩm là “voice conversation realtime” cho đến khi STT, turn detection và audio streaming được triển khai/test.

## F-12 — Điều phối AI, failover và quan sát vận hành

**Mục tiêu:** Một lỗi model hoặc workflow không khiến request biến mất hoặc được ghi nhận sai là thành công.

**Actor chính:** System Handler.  
**Actor hỗ trợ:** AI, Admin vận hành.

### Luồng chính

1. Mỗi request có trace ID và các định danh student/session/conversation/course cần thiết.
2. Handler phân nhánh RAG, CODE hoặc ESCALATE.
3. Các node quan trọng ghi log started/completed/error/fallback.
4. Provider chính được gọi với timeout/retry có giới hạn.
5. Khi provider không khả dụng, hệ thống dùng fallback/cooldown theo cấu hình.
6. Kết quả cuối được ghi đúng trạng thái và usage thực tế.

### Quy tắc nghiệp vụ

- n8n không có execution không đồng nghĩa AI không chạy: backend có thể đang đi đường trực tiếp. UI vận hành phải phân biệt execution path.
- Token nhỏ bất thường (ví dụ chỉ vài chục token) là tín hiệu cần audit, không phải bằng chứng duy nhất của lỗi.
- Retry nội bộ không được tạo nhiều message, trừ quota nhiều lần hoặc nhân đôi chi phí ghi nhận.
- Provider/model đã ngừng hỗ trợ không nên xóa khỏi cấu hình một cách làm vỡ dependency; phải disable hoặc loại khỏi chain có kiểm soát và có test cấu hình.

### Acceptance criteria

- Mọi request hiển thị “hoàn tất” phải có response hợp lệ hoặc trạng thái fallback được xác định.
- Khi cả provider chính và fallback lỗi, Student nhận thông báo có thể hành động; log chứa nguyên nhân gốc.
- Có thể truy vết một lượt từ FE request qua backend/n8n/provider bằng trace ID.

---

## 4. Quy tắc xuyên suốt hệ thống

### 4.1 Grounding và an toàn tri thức

- Không bịa nguồn, chapter, section hoặc page.
- Evidence phải hỗ trợ claim quan trọng, không chỉ chứa keyword giống câu hỏi.
- Nội dung thiếu bằng chứng phải được nêu là chưa đủ tài liệu hoặc chuyển Teacher.
- Chỉ tri thức đã qua đúng approval gate mới được tham gia RAG.

### 4.2 Phân quyền và riêng tư

- Student chỉ truy cập dữ liệu của mình và học liệu đúng phạm vi.
- Teacher chỉ truy cập lớp được phân công.
- Senior có quyền chuyên môn mở rộng nhưng mọi hành động approval phải được audit.
- Admin không mặc nhiên thay thế trách nhiệm chuyên môn của Senior, dù code hiện cho phép làm cổng duyệt dự phòng.

### 4.3 Tính nhất quán của trải nghiệm gia sư

- Nội dung kiến thức chung; chiến lược dạy là phần cá nhân hóa.
- Cấu trúc tối thiểu của lesson/understanding check phải do policy của ứng dụng kiểm soát, không phó mặc hoàn toàn cho randomness của LLM.
- Teacher directive có độ ưu tiên cao hơn suy đoán tự động về phong cách học.

### 4.4 Audit và khả năng phục hồi

- Request, answer, evidence, feedback, candidate và approval phải nối được thành chuỗi audit.
- Job indexing/reindex phải idempotent hoặc có cơ chế chống trùng.
- Lỗi hệ thống không được tiêu hao quota như một lượt học thành công nếu Student không nhận được câu trả lời hữu dụng.

## 5. Những nội dung không nên tuyên bố quá mức

- Project hiện chưa phải hội thoại voice hai chiều realtime như Google Meet; mới có TTS ở chiều AI đọc câu trả lời.
- Personalization hiện là course-scoped memory + Teacher directive + support level; chưa phải mô hình kiến thức học sinh hoàn chỉnh theo chuẩn knowledge tracing.
- AI grading là trợ lý chấm, không phải quyết định điểm tự động cuối cùng.
- RAG giúp giảm hallucination nhưng không bảo đảm đúng tuyệt đối; citation và human escalation vẫn bắt buộc cho tình huống quan trọng.

## 6. Truy vết tới sơ đồ Use Case

| Trang draw.io | Feature tương ứng |
|---|---|
| 00. Core AI Tutor | F-01 đến F-12; dùng làm sơ đồ Use Case chính khi trình bày |
| 1. Tổng quan nghiệp vụ | F-01, F-07, F-08, F-10 |
| 2. Phiên học AI Tutor | F-01, F-02, F-03, F-04, F-11, F-12 |
| 3. Cải tiến tri thức AI | F-07, F-08, F-09 |
| 4. Đánh giá học tập | F-05, F-06 |

## 7. Điểm cần ưu tiên nếu muốn sản phẩm đạt mức “AI Tutor thực thụ”

1. Chuẩn hóa lesson policy và understanding check để kết quả không thất thường giữa các Student.
2. Đo mastery theo concept/outcome thay vì chỉ lưu lịch sử hội thoại.
3. Thiết lập eval set theo từng course và regression gate trước khi đổi prompt/model/retrieval.
4. Hoàn thiện voice input/STT và turn-taking nếu “đa phương thức Voice/Text” là cam kết sản phẩm.
5. Bổ sung dashboard giải thích “AI cá nhân hóa vì dữ liệu nào” cho Teacher kiểm soát.
6. Đo retrieval bằng Recall@k, MRR/nDCG, citation precision và answer groundedness trên bộ câu hỏi thật.

