# Hướng Dẫn Triển Khai Railway

## 1. Cấu trúc kho mã nguồn

Railway triển khai hai ứng dụng từ cùng một Git repository:

```text
Ai_Turtor_FE/   # Frontend React/Vite
AI_Turtor_BE/   # Backend Spring Boot Java 17 và các workflow n8n
```

Thiết lập chính xác `Root Directory` trên Railway như sau:

- Frontend: `/Ai_Turtor_FE`
- Backend: `/AI_Turtor_BE`

Tạo tất cả service trong cùng một Railway project và đặt đúng tên:

- `frontend`
- `backend`
- `elasticsearch`
- `n8n`

Các tên này giúp những biến tham chiếu Railway trong tài liệu hoạt động chính xác.

## 2. Chuẩn bị trước khi triển khai

Chuẩn bị các giá trị sau:

- MongoDB Atlas URI trỏ tới database `tutor_db`.
- JWT secret mạnh, có ít nhất 64 ký tự ngẫu nhiên.
- Mật khẩu ban đầu mạnh cho tài khoản Admin và Swagger.
- API key cho dịch vụ LLM và embedding mà backend sử dụng.
- Một giá trị ngẫu nhiên cố định cho `N8N_ENCRYPTION_KEY`.

Không commit key thật, mật khẩu, Atlas URI, file `.env`, cấu hình local, database dump hoặc log lên Git.

## 3. Triển khai Elasticsearch

1. Thêm service từ Docker image `elasticsearch:8.13.0`.
2. Đặt tên service là `elasticsearch`.
3. Thiết lập các biến:

```env
discovery.type=single-node
xpack.security.enabled=false
ES_JAVA_OPTS=-Xms512m -Xmx512m
```

4. Gắn Railway Volume vào `/usr/share/elasticsearch/data`.
5. Giữ service ở chế độ private; Elasticsearch không cần public domain.
6. Cổng nội bộ của service là `9200`.

## 4. Triển khai Backend

1. Thêm một GitHub service từ repository này.
2. Đặt tên service là `backend`.
3. Đặt `Root Directory` là `/AI_Turtor_BE`.
4. Railway sẽ build bằng Dockerfile Java 17 có sẵn.
5. Tạo public domain cho service.
6. Đặt `Healthcheck Path` là `/actuator/health/liveness`. Liveness không phụ thuộc Elasticsearch, vì Elasticsearch chậm tạm thời không được làm Railway restart toàn bộ API.
7. Dán các biến sau vào `Raw Editor` của service, sau đó thay các placeholder bằng giá trị thật:

```env
PORT=8085
JAVA_OPTS=-Xms256m -Xmx768m
SPRING_DATA_MONGODB_URI=<mongodb-atlas-uri>
ELASTICSEARCH_HOST=${{elasticsearch.RAILWAY_PRIVATE_DOMAIN}}
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_INDEX=course_material_vectors_nemotron_2048
ELASTICSEARCH_CONNECT_TIMEOUT_MS=3000
ELASTICSEARCH_SOCKET_TIMEOUT_MS=5000
ELASTICSEARCH_CONNECTION_REQUEST_TIMEOUT_MS=3000
MANAGEMENT_HEALTH_ELASTICSEARCH_ENABLED=false

JWT_SECRET=<strong-random-secret>
JWT_EXPIRATION_MINUTES=1440
SWAGGER_USERNAME=swagger-admin
SWAGGER_PASSWORD=<strong-password>
ADMIN_ACCOUNT_EMAIL=<admin-email>
ADMIN_ACCOUNT_PASSWORD=<strong-password>
ADMIN_ACCOUNT_FULL_NAME=System Admin

APP_CORS_ALLOWED_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
APP_TIMEZONE=Asia/Ho_Chi_Minh
TZ=Asia/Ho_Chi_Minh
STUDENT_DAILY_QUESTION_LIMIT=10
AI_PRIVACY_SANITIZATION_ENABLED=true

RAG_EMBEDDING_PROVIDER=openrouter
OPENROUTER_EMBEDDING_API_KEY=<embedding-api-key>
OPENROUTER_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free

OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=<chat-api-key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=<available-chat-model>
OPENROUTER_FALLBACK_ENABLED=false
OPENROUTER_FREE_ROUTER_ENABLED=false

GROQ_ENABLED=false
NVIDIA_NIM_ENABLED=false
RAG_RERANK_ENABLED=false
RAG_VISUAL_ENABLED=false
OLLAMA_CHAT_ENABLED=false
```

Chỉ bật những provider đã có API key hợp lệ. Không nên chạy Ollama trong lần triển khai Railway đầu tiên vì Ollama cần nhiều RAM và dung lượng lưu model hơn so với việc dùng API từ nhà cung cấp bên ngoài.

Kiểm tra các đường dẫn:

- `https://<backend-domain>/actuator/health/liveness`
- `https://<backend-domain>/v3/api-docs`
- Đăng nhập bằng `POST https://<backend-domain>/api/users/login`

Sau khi đăng nhập Admin, kiểm tra Elasticsearch thật bằng:

```http
GET /api/admin/diagnostics/elasticsearch
Authorization: Bearer <ADMIN_JWT>
```

API trả `status`, cluster, phiên bản Elasticsearch, trạng thái index, số document và thời gian phản hồi. REST API vẫn là nguồn kiểm tra Elasticsearch; Web health chỉ dùng cho vòng đời container.

## 5. Triển khai n8n

1. Thêm service từ Docker image `docker.n8n.io/n8nio/n8n:latest`.
2. Đặt tên service là `n8n`.
3. Tạo public domain cho giao diện quản lý và webhook trên trình duyệt.
4. Gắn Railway Volume vào `/home/node/.n8n` để workflow và credential không bị mất khi redeploy.
5. Thiết lập các biến:

```env
PORT=5678
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_HOST=${{RAILWAY_PUBLIC_DOMAIN}}
N8N_EDITOR_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
WEBHOOK_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/
N8N_SECURE_COOKIE=true
N8N_ENCRYPTION_KEY=<fixed-random-secret>
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
N8N_DIAGNOSTICS_ENABLED=false
N8N_PERSONALIZATION_ENABLED=false
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
GENERIC_TIMEZONE=Asia/Ho_Chi_Minh
TZ=Asia/Ho_Chi_Minh
AI_TUTOR_API_BASE_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8085
```

6. Mở public domain của n8n và tạo tài khoản owner.
7. Import và activate các file trong `AI_Turtor_BE/n8n-import/docker-ready/`:

```text
AI-tutor-workflow-runtime-fixed.json
AI-tutor-v2-proactive-workflows.json
AI-tutor-teacher-ai-grading.json
```

8. Xác nhận mọi HTTP node gọi backend đều chuyển tiếp header `Authorization` nhận từ request ban đầu.
9. Dùng URL production `/webhook/...`, không dùng URL test `/webhook-test/...`.

Với một instance demo duy nhất, database của n8n trên Volume là đủ. Hãy dùng thêm Railway Postgres trước khi scale n8n thành nhiều replica.

## 6. Triển khai Frontend

1. Thêm một GitHub service khác từ cùng repository.
2. Đặt tên service là `frontend`.
3. Đặt `Root Directory` là `/Ai_Turtor_FE`.
4. Railway sẽ build Dockerfile của frontend và dùng Caddy để phục vụ SPA.
5. Tạo public domain cho service.
6. Đặt `Healthcheck Path` là `/health`.
7. Lần đầu nên triển khai theo chế độ gọi trực tiếp backend:

```env
VITE_API_BASE_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
VITE_API_TIMEOUT_MS=60000
VITE_API_WITH_CREDENTIALS=false
VITE_REALTIME_ENABLED=true
VITE_CHAT_SOCKET_URL=wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}/ws/chat
VITE_REALTIME_SOCKET_URL=wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}/ws/events

VITE_N8N_ENABLED=false
VITE_N8N_STRICT=false
VITE_N8N_BASE_URL=https://${{n8n.RAILWAY_PUBLIC_DOMAIN}}
VITE_N8N_WEBHOOK_MODE=production
VITE_N8N_TIMEOUT_MS=60000
VITE_N8N_CHAT_TIMEOUT_MS=180000
VITE_N8N_QUIZ_TIMEOUT_MS=240000
VITE_N8N_QUIZ_ENABLED=false
VITE_N8N_ASSIGNMENT_GRADING_ENABLED=false
VITE_N8N_ASSIGNMENT_GRADING_TIMEOUT_MS=300000
VITE_N8N_TUTOR_V2_ENABLED=false
VITE_N8N_TUTOR_V2_TIMEOUT_MS=300000
VITE_N8N_TUTOR_V2_FLOW_TIMEOUT_MS=120000
VITE_N8N_TUTOR_V2_APPROVAL_TIMEOUT_MS=240000
VITE_N8N_TUTOR_V2_EVALUATION_TIMEOUT_MS=300000
```

Các biến `VITE_*` được nhúng vào bản build. Phải redeploy frontend sau mỗi lần thay đổi các biến này.

## 7. Bật dần các flow n8n

Sau khi kiểm tra thành công đăng nhập, chat, quiz, material và WebSocket ở chế độ gọi trực tiếp backend:

1. Kiểm tra trực tiếp production webhook của Student Chat trong n8n.
2. Đặt `VITE_N8N_ENABLED=true` và redeploy frontend.
3. Kiểm tra RAG, CODE, ESCALATE, teacher final answer và senior approve/reject.
4. Chỉ bật quiz sau khi response contract của workflow đã đúng: `VITE_N8N_QUIZ_ENABLED=true`.
5. Chỉ bật chấm File Assignment sau khi workflow tương ứng đã chạy đúng: `VITE_N8N_ASSIGNMENT_GRADING_ENABLED=true`.
6. Chỉ bật Tutor V2 sau khi tất cả webhook V2 đã chạy đúng: `VITE_N8N_TUTOR_V2_ENABLED=true`.
7. Giữ `VITE_N8N_STRICT=false` trong giai đoạn smoke test. Chỉ chuyển sang `true` khi không muốn FE fallback về backend.

## 8. Kiểm tra nhanh sau khi triển khai

- Đăng nhập bằng đủ bốn role: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Refresh các route con của frontend; Caddy phải trả React application thay vì lỗi 404.
- Xác nhận CORS API cho phép public domain của frontend.
- Xác nhận `/ws/chat` và `/ws/events` kết nối bằng `wss://`.
- Student Chat: kiểm tra RAG, CODE, ESCALATE, lịch sử, ghim tin nhắn vẫn còn sau khi đăng nhập lại và chuyển conversation khi đủ 10 câu hỏi.
- Student Quiz: kiểm tra tạo quiz, nộp bài, xem kết quả và quiz được giao.
- Teacher: kiểm tra publish quiz/assignment, review attempt và escalation flow.
- Senior/Admin: kiểm tra approve/reject tri thức và review Tutor V2.
- Admin: kiểm tra upload PDF, import URL, trạng thái indexing, CRUD học vụ và AI logs.
- Restart `n8n` và `elasticsearch`; dữ liệu phải vẫn còn nhờ các Volume đã gắn.
