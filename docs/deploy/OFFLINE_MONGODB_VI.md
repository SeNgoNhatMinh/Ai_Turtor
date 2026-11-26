# MongoDB local cho AI Tutor offline

Backend chạy với MongoDB 8.0.17 trong Docker trên máy chủ thay vì MongoDB Atlas.
Cấu hình Atlas (`docker-compose.deploy.yml` + `.env.deploy`) vẫn giữ nguyên; chế độ offline chỉ thêm file override.

| Thành phần | File |
| --- | --- |
| Compose override | `AI_Turtor_BE/docker-compose.offline.yml` |
| Biến môi trường (git-ignored, quyền 600) | `AI_Turtor_BE/.env.offline` (mẫu: `.env.offline.example`) |
| Tạo user ứng dụng lần đầu | `AI_Turtor_BE/docker/mongo-offline/init/01-create-app-user.js` |
| Script | `AI_Turtor_BE/scripts/offline/` |
| Backup (git-ignored) | `AI_Turtor_BE/backup/` |

Đặc điểm:

- Database `tutor_db`, bật auth. Backend dùng user `tutor_app` (chỉ có quyền `readWrite` trên `tutor_db`); root chỉ dùng cho backup/restore.
- Backend kết nối qua hostname Docker `mongodb:27017`. Cổng 27017 chỉ bind ra `127.0.0.1`, nên các máy trong LAN không truy cập được.
- Volume `ai_turtor_be_ai_tutor_offline_mongo_data`, `restart: unless-stopped`, có healthcheck. Backend chỉ khởi động khi Mongo đã healthy.
- Các volume Mongo cũ (`ai-tutor-api_*mongo*`) không được sử dụng và không bị đụng tới.

## Chạy hệ thống

```bash
cd AI_Turtor_BE
scripts/offline/compose.sh up -d          # toàn bộ stack với Mongo local
scripts/offline/compose.sh ps
scripts/offline/compose.sh logs -f ai-tutor-api
```

Lưu ý: chạy `docker compose` **không kèm** `docker-compose.offline.yml` sẽ đưa backend quay lại Atlas.
Không bao giờ chạy `down -v`, vì lệnh này xóa volume dữ liệu.

## AI local (Ollama trên Mac)

`docker-compose.offline.yml` đặt cố định các giá trị sau, không đọc từ `.env.deploy`:

- **Chat:** Ollama `gemma3:4b` (biến `LOCAL_AI_CHAT_MODEL` trong `.env.offline`; mặc định của compose là `gemma3:12b`). Với `gemma3:4b` mỗi câu hỏi mất khoảng 1 phút; với `gemma3:12b` khoảng 3 phút nhưng câu trả lời chính xác hơn. Ollama chạy native trên Mac để dùng GPU Metal, backend gọi qua `http://host.docker.internal:11434`.
- **Embedding:** `embeddinggemma`, ghi vào index Elasticsearch riêng `course_material_vectors_embeddinggemma_768`. Các index cloud cũ được giữ nguyên.
- **Tắt toàn bộ nhà cung cấp cloud:** Groq, NVIDIA, OpenRouter, Prompt Guard, TTS, rerank, visual RAG. Biến env `*_ENABLED=false` luôn thắng cấu hình trong trang Admin.
- **n8n:** node "Groq Chat Model" của Flow 2 đã được thay bằng node Ollama (credential "Ollama local (offline)"). Bản workflow gốc lưu ở `backup/n8n/`. Áp dụng lại cho file workflow khác:
  `python3 -I scripts/offline/n8n_use_ollama.py IN.json OUT.json gemma3:4b`
  Khi đổi model chat: sửa `LOCAL_AI_CHAT_MODEL`, chạy `scripts/offline/compose.sh up -d ai-tutor-api`, đổi model của node Ollama trong n8n Flow 2 rồi khởi động lại n8n.

Kiểm tra sau khi khởi động:

```bash
docker logs ai-tutor-api 2>&1 | grep "LLM provider chain reloaded"
# mong đợi: ollamaOnly=true, providers=[ollama/<LOCAL_AI_CHAT_MODEL>]
```

Chuẩn bị model (chỉ cần Internet lần đầu):

```bash
ollama pull gemma3:12b && ollama pull embeddinggemma
```

Khi đổi model embedding, phải index lại toàn bộ tài liệu:

```bash
scripts/offline/reindex-all.sh
```

## Truy cập qua LAN

- Máy khách vào `http://192.168.0.101` (biến `LAN_PUBLIC_URL` trong `.env.offline`). Nên đặt IP cố định (DHCP reservation) cho Mac trên router TP-Link.
- Trình duyệt gọi n8n qua cùng origin (`/webhook/*`, Caddy proxy sang `n8n:5678`). Vì vậy bản build frontend không chứa IP và chạy được ở bất kỳ mạng nào.
- Chỉ cổng 80 (web) và 8085 (API) mở ra LAN. MongoDB, Redis, Elasticsearch và n8n editor chỉ bind `127.0.0.1`.
- Tắt chế độ ngủ của Mac: System Settings → Battery/Energy → *Prevent automatic sleeping*.
- Sau khi sửa `VITE_*` hoặc Caddyfile: `scripts/offline/compose.sh build ai-tutor-frontend && scripts/offline/compose.sh up -d`.

## Backup định kỳ (MongoDB local)

```bash
scripts/offline/dump.sh local
```

Script tạo `backup/local_tutor_db_<timestamp>.archive.gz`, rồi kiểm tra archive (`gzip -t`, `mongorestore --dryRun`) và tạo file `.sha256`.
Nên chép thêm thư mục `backup/` ra ổ ngoài.

## Restore vào MongoDB local

```bash
scripts/offline/restore-local.sh backup/<file>.archive.gz
```

- Script kiểm tra sha256 trước khi restore, chỉ cho phép ghi vào Mongo local và không dùng `--drop`.
- Script từ chối chạy nếu `tutor_db` local đã có dữ liệu.

## Đồng bộ lại từ Atlas (nếu cần)

```bash
scripts/offline/dump.sh atlas      # chỉ đọc Atlas
scripts/offline/verify.sh          # so sánh Atlas và local: count, index, SHA-256 của từng collection
```

## Kết quả migration ngày 2026-11-25

- Atlas 8.0.39 → local 8.0.17. Restore 12.551 document, 0 lỗi.
- `verify.sh`: 55/55 collection khớp về số document, hash nội dung (EJSON canonical, giữ nguyên kiểu ObjectId/Date/Int64/Binary) và index.
- Backend khởi động bình thường; đăng nhập admin, dashboard, users, mentors, courses và escalations đều trả 200.
