# AI Tutor — Mobile (Flutter)

Ứng dụng mobile cho **AI Tutor Platform**, kết nối backend Spring Boot `ai-tutor-api` (Docker `:8085`) và n8n webhooks (`:5678`).

## Yêu cầu

- Flutter SDK ^3.9
- Backend đang chạy (xem repo `ai-tutor-api`, `docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d`)

## Chạy app

### Emulator / simulator (mặc định)

```bash
cd D:\Capstone\AI-Tutor\ai_tutor
flutter pub get
flutter run
```

- **Android emulator**: API → `http://10.0.2.2:8085`, n8n → `http://10.0.2.2:5678/webhook`
- **iOS simulator / Windows desktop**: `localhost:8085` / `5678`

### Máy thật (cùng Wi‑Fi với PC chạy Docker)

Thay `<LAN-IP>` bằng IP máy host (vd. `192.168.1.10`):

```bash
flutter run ^
  --dart-define=API_BASE_URL=http://<LAN-IP>:8085 ^
  --dart-define=N8N_WEBHOOK=http://<LAN-IP>:5678/webhook
```

## Build APK production

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://backend-production-0011.up.railway.app \
  --dart-define=N8N_WEBHOOK=https://n8n-production-1b35.up.railway.app/webhook
```

`N8N_WEBHOOK` phải chứa prefix `/webhook`. Network client dùng chung sẽ
chuẩn hóa mọi request thành `/webhook/{flow}`.

## Đồng bộ với BE mới (2026)

| Tính năng BE | Mobile |
|--------------|--------|
| Upload material **chỉ PDF**, HTTP **202** + `indexingStatus` | Teacher/Admin upload PDF, badge trạng thái index |
| Visual RAG (`sourceEvidence` / ảnh trang PDF) | Strip thumbnail trong bubble chat AI |
| Giới hạn câu hỏi/ngày (`DAILY_QUESTION_LIMIT_REACHED`) | Banner trong chat (đã có) |
| `suggestions/learn`, improve, quiz, escalation | REST `:8085` + n8n webhooks |

## Auth

Backend **bắt JWT** trên hầu hết REST (`SecurityConfig`). Login/register trả `token` — app lưu
`auth_token` (secure storage) và gửi `Authorization: Bearer <token>` qua Dio. Vẫn gửi `userId`
trên query/body theo từng API. Swagger: Basic Auth; API nghiệp vụ: JWT.

- Admin dev: `admin@system.local` / mật khẩu trong `.env.deploy` của `ai-tutor-api`
- Môn học demo DB: **PRJ301**, **CSI106**, **OSG203** (không còn MAD/MAS)

## Backend repo

Spring Boot: `D:\Be\AI-tutor\AI-tutor\AI-tutor\AI-tutor\AI-tutor\AI-tutor\ai-tutor-api`

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
```

Link nhanh: http://localhost:8090/ (Swagger, n8n, health)

## Kiểm tra nhanh

```bash
flutter analyze
flutter test
```
