# Chạy AI Tutor hoàn toàn local trên 1 máy, các máy khác vào bằng IP

Mục tiêu: **một máy (máy chủ) chạy tất cả**: web, backend, n8n, MongoDB, Redis, Elasticsearch và **AI bằng Ollama**. Không dùng dịch vụ cloud nào. Các máy khác cùng router mở trình duyệt vào `http://<IP máy chủ>` là dùng được.

```text
Máy khách ──http://192.168.1.220──▶ Máy chủ (IP do router cấp)
                                      ├─ :80     web (chuyển tiếp /api, /ws sang backend)
                                      ├─ :5678   n8n (trình duyệt gọi trực tiếp)
                                      ├─ :8085   backend  ─┐
                                      ├─ MongoDB, Redis,   │ chỉ dùng nội bộ
                                      │  Elasticsearch     │ trong máy chủ
                                      └─ Ollama :11434  ◀──┘ (chat + embedding)
```

Trong hướng dẫn dùng `192.168.1.220` làm ví dụ, bạn thay bằng IP thật ở Bước 2.

---

## Bước 1. Cùng một router

- Máy chủ và tất cả máy khách cắm dây hoặc bắt **cùng một Wi-Fi/router**.
- Hệ thống chạy local nên **không cần internet**. Chỉ cần internet một lần để tải Docker image và model Ollama (Bước 3, 6).
- Không dùng Wi-Fi có "client isolation" (Wi-Fi khách, Wi-Fi trường): các máy sẽ không thấy nhau. Nếu Bước 2 không `ping` được, dùng router hoặc điểm phát riêng.

## Bước 2. Lấy IP của máy chủ và cố định IP

**macOS:**

```bash
ipconfig getifaddr en0      # Wi-Fi; nếu trống thử en1 (cắm dây)
```

**Windows:** chạy `ipconfig`, xem dòng `IPv4 Address`.

**Cố định IP** để địa chỉ không đổi sau khi khởi động lại (vì IP này được ghi cứng vào web ở Bước 4): vào trang quản trị router (thường `192.168.1.1`), mục DHCP → *Address Reservation / Static Lease*, gán IP cho máy chủ.

Kiểm tra từ một máy khách:

```bash
ping 192.168.1.220
```

## Bước 3. Cài Ollama và tải model trên máy chủ

- **macOS:** cài app Ollama từ ollama.com. Nên chạy Ollama trực tiếp trên máy, không chạy trong Docker, vì Docker trên Mac không dùng được GPU nên rất chậm.
- **Windows/Linux:** cài Ollama từ ollama.com, hoặc dùng container có sẵn (`--profile ollama`, xem Bước 6).

Tải 2 model (chat và embedding):

```bash
ollama pull gemma3:4b
ollama pull embeddinggemma
ollama list                 # phải thấy cả hai
```

> Máy mạnh hơn có thể dùng model chat lớn hơn (ví dụ `gemma3:12b`) để trả lời tốt hơn; nhớ sửa `OLLAMA_CHAT_MODEL` ở Bước 4.

## Bước 4. Cấu hình `AI_Turtor_BE/.env.deploy`

Sửa hoặc thêm các dòng sau. Thay `192.168.1.220` bằng IP ở Bước 2.

```env
# --- Truy cập bằng IP ---
FRONTEND_PORT=80
VITE_API_BASE_URL=/api
VITE_N8N_BASE_URL=http://192.168.1.220:5678
APP_CORS_ALLOWED_ORIGINS=http://192.168.1.220,http://localhost,http://localhost:5173

# --- AI local: chỉ dùng Ollama ---
# Ollama chạy trực tiếp trên máy chủ (Mac/Windows):
OLLAMA_BASE_URL=http://host.docker.internal:11434
# (nếu dùng container --profile ollama thì: OLLAMA_BASE_URL=http://ollama:11434)
OLLAMA_CHAT_ENABLED=true
OLLAMA_CHAT_MODEL=gemma3:4b
OLLAMA_CHAT_TIMEOUT_SECONDS=0
RAG_EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=embeddinggemma

# Để TRỐNG mọi key cloud, khi đó backend tự chạy chế độ chỉ Ollama:
GROQ_API_KEY=
GROQ_WORKER1_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_FALLBACK_API_KEY=
OPENROUTER_EMBEDDING_API_KEY=
OPENROUTER_RERANK_API_KEY=
NVIDIA_API_KEY=
NVIDIA_NIM_API_KEY=
NVIDIA_EMBEDDING_API_KEY=
CEREBRAS_API_KEY=

# Prompt Guard đang gọi Groq, tắt khi chạy local:
AI_WORKER_PROMPT_GUARD_ENABLED=false

# --- MongoDB local (container mongodb) ---
SPRING_DATA_MONGODB_URI=mongodb://mongodb:27017/tutor_db
```

> Các biến `VITE_*` được ghi cứng lúc build web. Đổi xong phải build lại (Bước 6), restart thôi là không đủ.
>
> Nếu trang Admin → *Cấu hình nhà cung cấp LLM* đã lưu sẵn key cloud, hãy tắt các nhà cung cấp đó ở trang này nữa.

## Bước 5. (Nếu cần giữ dữ liệu cũ) Chuyển dữ liệu từ MongoDB Atlas về máy

Làm **trước** khi chạy Bước 6 nếu muốn giữ tài khoản, môn học, học liệu, lịch sử chat đang có trên Atlas.

```bash
cd AI_Turtor_BE
# 1) Sao lưu từ Atlas (thay <ATLAS_URI> bằng URI Atlas cũ)
MONGO_BACKUP_SOURCE_URI="<ATLAS_URI>" \
  docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile db-tools run --rm mongo-backup

# 2) Bật MongoDB local rồi khôi phục vào đó
docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile local-db up -d mongodb
docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile db-restore run --rm mongo-restore
```

File sao lưu nằm ở `AI_Turtor_BE/backup/tutor_db.archive.gz`. Bỏ qua bước này nếu muốn bắt đầu với dữ liệu trống.

## Bước 6. Build và chạy toàn bộ

```bash
cd AI_Turtor_BE
docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile local-db up -d --build
# Windows/Linux dùng Ollama trong Docker thì thêm: --profile ollama
docker ps --format '{{.Names}}  {{.Ports}}'
```

Phải thấy (ít nhất):

```text
ai-tutor-frontend  0.0.0.0:80->3000/tcp
ai-tutor-api       0.0.0.0:8085->8085/tcp
ai-tutor-n8n       0.0.0.0:5678->5678/tcp
ai-tutor-mongodb   0.0.0.0:27017->27017/tcp
```

Kiểm tra backend đã chạy chế độ chỉ Ollama:

```bash
docker logs ai-tutor-api 2>&1 | grep "LLM provider chain reloaded"
# mong đợi: ollamaOnly=true, providers=[ollama/gemma3:4b]
```

**Index lại tài liệu (bắt buộc):** embedding đã đổi sang Ollama, nên vector cũ (tạo bằng NVIDIA) không dùng được nữa. Đăng nhập Admin → **Reindex** → chạy lại cho tất cả môn. Chưa reindex thì AI sẽ không tìm thấy tài liệu môn học.

## Bước 7. Mở tường lửa trên máy chủ

- **macOS:** System Settings → Network → Firewall. Nếu đang bật, vào *Options* và cho phép **Docker** nhận kết nối.
- **Windows** (PowerShell chạy Admin):

  ```powershell
  New-NetFirewallRule -DisplayName "AI Tutor LAN" -Direction Inbound -Protocol TCP -LocalPort 80,5678 -Action Allow
  ```

Chỉ mở **80** (web) và **5678** (n8n). Không cần mở 8085, 27017 hay 11434 cho máy khách.

## Bước 8. Các máy khác truy cập

Trên mọi máy khách, mở trình duyệt vào:

```text
http://192.168.1.220
```

Gõ rõ `http://`. Không cần sửa file hosts hay cài thêm gì trên máy khách.

Kiểm tra nhanh từ một máy khách:

```bash
curl -I http://192.168.1.220/health      # HTTP 200
curl -I http://192.168.1.220:5678        # n8n trả 200 hoặc 3xx
```

Sau đó đăng nhập, hỏi một câu trong **Trò chuyện AI Tutor** để chắc chat, n8n và Ollama đều chạy.

---

## Lưu ý

- **Tốc độ:** mọi câu trả lời do Ollama trên máy chủ tạo ra. Model `gemma3:4b` chạy CPU có thể mất vài chục giây đến vài phút mỗi câu, và chậm hơn khi nhiều người hỏi cùng lúc. Hệ thống đã được chỉnh để **chờ tới 6 giờ**, không tự cắt câu trả lời.
- **Máy chủ phải luôn bật, không ngủ:** macOS vào System Settings → Battery/Energy → bật *Prevent automatic sleeping*.
- **Nếu IP máy chủ đổi:** sửa `VITE_N8N_BASE_URL` và `APP_CORS_ALLOWED_ORIGINS` theo IP mới, rồi chạy lại Bước 6. Vì vậy nên cố định IP ở Bước 2.

## Xử lý sự cố

| Hiện tượng | Kiểm tra / cách sửa |
|---|---|
| Máy khách không `ping` được máy chủ | Khác mạng hoặc Wi-Fi bật client isolation (Bước 1); tường lửa Windows chặn ICMP |
| Mở `http://<IP>` không vào được | `docker ps` có `ai-tutor-frontend 0.0.0.0:80`? Tường lửa đã mở cổng 80? Cổng 80 bị dịch vụ khác chiếm thì đặt `FRONTEND_PORT=3000` và vào `http://<IP>:3000` |
| Trang mở được nhưng chat báo lỗi trên máy khách | `VITE_N8N_BASE_URL` vẫn là `localhost`: sửa thành `http://<IP>:5678`, **build lại** (Bước 6), mở cổng 5678 |
| Lỗi CORS trong Console (F12) | Thêm đúng `http://<IP>` vào `APP_CORS_ALLOWED_ORIGINS`, build lại |
| Log không có `ollamaOnly=true` | Còn key cloud trong `.env.deploy` hoặc trong trang Admin → Cấu hình nhà cung cấp LLM |
| AI báo không tìm thấy tài liệu | Chưa **Reindex** sau khi đổi embedding (Bước 6) |
| Backend không gọi được Ollama | Trên máy chủ chạy `curl http://localhost:11434/api/tags`; kiểm tra `OLLAMA_BASE_URL` (Bước 4) |
