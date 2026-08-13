# Huong dan test demo Education va deploy Render

## 1. Ket qua da xac minh

He thong da duoc test tren Docker theo mot chu trinh education hoan chinh:

1. Student dang nhap va duoc enroll vao `PRJ301/SE1840`.
2. Student hoi ly thuyet; n8n dinh tuyen sang RAG va tra loi theo tai lieu mon hoc.
3. Student gui code loi; n8n dinh tuyen sang Code Mentor.
4. Student review cau tra loi AI voi ba nhanh: tot, can mentor, can senior.
5. Mentor mo feedback/escalation, tra loi student va tuy chon tao KnowledgeCandidate.
6. Senior approve candidate de index vao RAG Brain, hoac reject de AI khong hoc.
7. Student va teacher tao quiz bang AI.
8. Student nop quiz; backend cham diem va cap nhat learning memory.

Lan test cuoi ngay 17/07/2026 dat **16/16 buoc**. Quiz chuyen `GENERATED -> SUBMITTED`, diem test `1/3`, response n8n co `status=SUBMITTED`.

Tai lieu RAG demo: `output/pdf/PRJ301-demo-learning-material.pdf`. Tai lieu da index thanh 3 chunks, vector 2048 chieu.

## 2. Chay local bang Docker

Tai thu muc `ai-tutor-api`:

```powershell
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
```

Kiem tra:

```powershell
Invoke-RestMethod http://localhost:8085/actuator/health
Invoke-RestMethod http://localhost:5678/healthz
```

Swagger duoc bao ve bang HTTP Basic. Truy cap `/swagger-ui/index.html` va dung tai khoan Swagger tu bien moi truong; khong dua thong tin nay vao FE.

Chay test E2E:

```powershell
.\test-n8n-all-flows.ps1
```

Du lieu request mau nam trong `demo-data/education-demo-data.json`. Tai khoan trong file chi dung cho local/demo va phai doi khi public.

## 3. Mapping nghiep vu cho FE

### Student

- Dang nhap: `POST /api/users/login`.
- Dashboard: `GET /api/students/{studentId}/dashboard`.
- Danh sach mon: `GET /api/students/{studentId}/courses`.
- Chat AI qua n8n: `POST {N8N_PUBLIC_URL}/webhook/student-chat`.
- Review answer qua n8n: `POST {N8N_PUBLIC_URL}/webhook/answer-review`.
- Lich su quiz: `GET /api/tutor/students/{studentId}/courses/{courseId}/quizzes`.
- Tao quiz tu on qua n8n: `POST {N8N_PUBLIC_URL}/webhook/quiz-generate` voi studentId.
- Nop quiz qua n8n: `POST {N8N_PUBLIC_URL}/webhook/quiz-submit`.
- Chat mentor REST: `/api/chat/send`, `/api/chat/history`, `/api/chat/detail`, `/api/chat/mark-read`, `/api/chat/unread`, `/api/chat/close`.
- Chat realtime: `wss://{BACKEND_HOST}/ws/chat?token={JWT}&chatRoomId={ROOM_ID}`.

WebSocket client gui:

```json
{"type":"SEND_MESSAGE","senderName":"Happy Flow Student","content":"Em can mentor giai thich them.","messageType":"TEXT"}
```

Server tra `CONNECTED`, `NEW_MESSAGE`, `PONG` hoac `ERROR`. JWT va `chatRoomId` deu duoc backend kiem tra; student khong the vao room khac.

### Teacher (mentor mac dinh co role `TEACHER`)

- Dashboard: `GET /api/teachers/{teacherId}/dashboard`.
- Inbox escalation: `GET /api/teachers/{teacherId}/escalations/inbox`.
- Feedback can mentor: `GET /api/tutor/answer-reviews/mentor-pending`.
- Tra loi escalation va tuy chon tao candidate qua n8n: `POST {N8N_PUBLIC_URL}/webhook/teacher-answer-escalation`.
- Danh sach quiz attempts: `GET /api/tutor/teachers/{teacherId}/quiz-attempts`.
- Review diem cuoi: `PUT /api/tutor/quizzes/{quizSessionId}/teacher-review`.
- Tao draft quiz qua n8n: `POST {N8N_PUBLIC_URL}/webhook/quiz-generate` voi teacherId.
- Sua/publish assignment: `PUT /api/tutor/quiz-assignments/{id}` va `POST /api/tutor/quiz-assignments/{id}/publish`.

### Senior/Admin

- Feedback can senior: `GET /api/tutor/answer-reviews/senior-pending`.
- Resolve feedback: `POST {N8N_PUBLIC_URL}/webhook/senior-review-resolution`.
- Candidate dang cho: `GET /api/tutor/knowledge-candidates/senior-pending`.
- Approve/reject qua n8n: `POST {N8N_PUBLIC_URL}/webhook/senior-knowledge-approval`.
- Admin doi teacher thanh `TEACHER` hoac `SENIOR_MENTOR`: `PATCH /api/admin/teachers/{teacherId}/role`.

Quy tac quan trong: feedback khong tu dong vao RAG. Chi candidate da `APPROVE` va index thanh cong moi tro thanh kien thuc AI. Candidate bi `REJECT` khong duoc index.

## 4. Webhook n8n va status FE can xu ly

| Webhook | Ket qua chinh |
|---|---|
| `student-chat` | `RAG_TUTOR`, `CODE`, `ESCALATE` |
| `answer-review` | `SUBMITTED`, `NEEDS_MENTOR_REVIEW`, `NEEDS_SENIOR_REVIEW` |
| `teacher-answer-escalation` | `knowledgeCandidateCreated=true/false` |
| `senior-review-resolution` | `RESOLVED`, co the kem candidateId |
| `senior-knowledge-approval` | `APPROVE` hoac `REJECT` |
| `quiz-generate` | `GENERATED`, `DRAFT_CREATED`, hoac `FAILED` neu LLM het quota |
| `quiz-submit` | `SUBMITTED` hoac `SUBMITTED_WAITING_TEACHER_REVIEW` |

Moi request n8n nen co `traceId`, `authToken` va cac ID dung nghiep vu. FE khong tu suy ra thanh cong tu HTTP 200; phai doc `success/status`.

### Quy tac UTF-8 cho FE/n8n

- Gui JSON voi header `Content-Type: application/json; charset=utf-8`.
- Khong tu chuyen chuoi qua Latin-1/Windows-1252 va khong `decodeURIComponent` them lan nua.
- Tieng Viet co dau (`JSP la gi` viet co dau) va khong dau deu duoc backend chap nhan.
- Chuoi co dau phai duoc giu nguyen; `Ã`, `Ä`, `Â`, `�` la dau hieu mojibake, khong phai tieng Viet khong dau.
- Execution n8n cu la snapshot va khong duoc sua lai sau khi import workflow moi. Chi dung execution tao sau thoi diem Publish de xac minh.
- File can import/publish la `n8n-import/AI-tutor-workflow-runtime-fixed.json`, khong phai ban source cu dang mo trong editor.

## 5. Deploy backend tren Render

Render Web Service chi chay backend image/Dockerfile, khong chay ca Docker Compose nhu local. Can dich vu ben ngoai:

- MongoDB Atlas cho database/GridFS.
- Elastic Cloud hoac Elasticsearch public tuong thich.
- n8n public dang chay rieng.
- OpenRouter cho chat, embedding va rerank; Ollama de `false` tren may Render yeu.

Dat Health Check Path: `/actuator/health`.

Bien moi truong toi thieu (gia tri that dat trong Render Secrets):

```text
SPRING_DATA_MONGODB_URI
SPRING_ELASTICSEARCH_URIS
JWT_SECRET
ADMIN_PASSWORD
SWAGGER_USERNAME
SWAGGER_PASSWORD
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_FALLBACK_ENABLED=true
OPENROUTER_FALLBACK_API_KEY
OPENROUTER_FALLBACK_MODEL
OPENROUTER_EMBEDDING_ENABLED=true
OPENROUTER_EMBEDDING_API_KEY
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_EMBEDDING_DIMENSIONS=2048
OLLAMA_CHAT_ENABLED=false
APP_CORS_ALLOWED_ORIGINS=https://YOUR-FE-DOMAIN
```

Khong copy `application-local.yml`, `.env.deploy`, JWT secret hay API key vao Git/FE. Cac key tung chia se trong chat nen duoc rotate truoc khi public demo.

## 6. Noi n8n public voi Render backend

Workflow local dung `host.docker.internal:8085`. Tao file import cho Render bang lenh:

```powershell
.\prepare-n8n-render-workflow.ps1 -BackendBaseUrl https://YOUR-BACKEND.onrender.com
```

Import `n8n-import/AI-tutor-workflow-render-ready.json` vao n8n public, kiem tra lai credential, sau do Publish. Khong import de len workflow dang demo neu chua backup.

Sau khi deploy:

1. Goi `https://YOUR-BACKEND.onrender.com/actuator/health`.
2. Login de lay JWT moi.
3. Upload/reindex PDF demo vi Elasticsearch production la index moi.
4. Goi `student-chat`, `answer-review`, `teacher-answer-escalation`, approval va quiz theo dung thu tu.
5. Kiem tra `/api/harness/traces/{traceId}` neu flow loi.

## 7. Checklist demo truoc khi trinh bay

- Backend health va n8n health deu `UP`.
- PDF demo da co status `INDEXED`.
- Student demo da enroll `PRJ301/SE1840`.
- OpenRouter con quota; neu quiz fail, UI hien thong bao thu lai thay vi treo.
- Swagger co Basic Auth; API nghiep vu co JWT/RBAC.
- FE dung `wss://` khi backend la HTTPS.
- Khong hien API key, JWT secret, email/du lieu sinh vien that tren man hinh demo.
