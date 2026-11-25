# MongoDB local cho AI Tutor offline

Backend chạy với MongoDB 8.0.17 trong Docker trên máy chủ thay vì MongoDB Atlas.
Cấu hình Atlas (`docker-compose.deploy.yml` + `.env.deploy`) vẫn giữ nguyên; chế độ offline chỉ thêm file override.

| Thành phần | File |
|---|---|
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
