# AI Tutor Platform - Deploy Handoff Guide

File này dùng để gửi cho người khác hoặc đưa cho AI khác hỗ trợ deploy project.

## 1. Mục tiêu deploy

Deploy hệ thống AI Tutor Platform cho FE sử dụng, gồm:

```text
Frontend
  ↓
n8n Harness
  ↓
ai-tutor-api Spring Boot
  ├─ MongoDB
  ├─ Elasticsearch
  ├─ Ollama Embedding
  └─ OpenRouter LLM
```

Hệ thống hỗ trợ:

- Chat AI Tutor theo từng `courseId`.
- RAG chỉ tìm tài liệu môn học, không search global.
- Code Mentor hỗ trợ debug/code, không làm hộ assignment full.
- Escalation cho mentor/teacher khi AI không chắc.
- Teacher answer -> KnowledgeCandidate.
- Senior Mentor approve -> index vào RAG Brain.
- n8n đóng vai trò AI Harness điều phối flow.

## 2. Công nghệ

Backend:

```text
Java 17
Spring Boot 3.2.5
MongoDB
Elasticsearch 8.13.0
LangChain4j
OpenRouter/OpenAI-compatible LLM
Ollama Embedding
n8n
Docker Compose
```

## 3. Yêu cầu server khuyến nghị

Vì project dùng Elasticsearch + MongoDB + n8n + Ollama, nên không nên deploy lên máy quá yếu.

Khuyến nghị cho môi trường trường học:

```text
CPU: 4 cores trở lên
RAM: 16GB khuyến nghị, 8GB chỉ demo nhỏ
Disk: 80GB trở lên
OS: Ubuntu Server 22.04/24.04 hoặc Linux tương đương
Docker + Docker Compose plugin
```

Nếu nhiều tài liệu PDF/course thì nên tăng disk.

## 4. File deploy đã có trong project

Các file cần dùng:

```text
Dockerfile
docker-compose.deploy.yml
.env.deploy.example
DEPLOYMENT_GUIDE.md
FRONTEND_N8N_INTEGRATION_GUIDE.md
```

Ý nghĩa:

| File | Chức năng |
|---|---|
| `Dockerfile` | Build backend Spring Boot thành Docker image |
| `docker-compose.deploy.yml` | Chạy backend, MongoDB, Elasticsearch, n8n, Ollama |
| `.env.deploy.example` | Template biến môi trường deploy |
| `DEPLOYMENT_GUIDE.md` | Hướng dẫn deploy chi tiết |
| `FRONTEND_N8N_INTEGRATION_GUIDE.md` | Hướng dẫn FE gọi n8n webhook |

## 5. Lưu ý dữ liệu fake

Local dev database đã được drop trước khi chuẩn bị deploy:

```text
MongoDB database tutor_db: dropped
Elasticsearch index course_material_vectors: xóa nếu tồn tại để reset dữ liệu RAG
```

Khi deploy server mới bằng Docker volume mới thì DB sẽ sạch sẵn.

Không xóa n8n data nếu đã import workflow thật.

## 6. Chuẩn bị server

Cài Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng xuất/đăng nhập lại rồi kiểm tra:

```bash
docker version
docker compose version
```

## 7. Cấu hình env deploy

Trong thư mục project:

```bash
cp .env.deploy.example .env.deploy
nano .env.deploy
```

Các biến bắt buộc/sửa chính:

```env
OPENROUTER_API_KEY=sk-or-real-key-here
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_RERANK_API_KEY=
RAG_RERANK_ENABLED=true
RAG_RERANK_MODEL=nvidia/llama-nemotron-rerank-vl-1b-v2:free
RAG_RETRIEVAL_TOP_K=20
RAG_RERANK_TOP_K_AFTER=5

N8N_HOST=your-domain-or-server-ip
N8N_PROTOCOL=http
N8N_EDITOR_BASE_URL=http://your-domain-or-server-ip:5678
WEBHOOK_URL=http://your-domain-or-server-ip:5678/
N8N_SECURE_COOKIE=false

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=embeddinggemma

# MongoDB Atlas; database name tutor_db phải nằm trong URI.
SPRING_DATA_MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/tutor_db?retryWrites=true&w=majority

# Thư mục archive và nguồn dùng cho job backup one-shot.
MONGO_BACKUP_DIR=./backup
MONGO_BACKUP_SOURCE_URI=mongodb+srv://username:password@cluster.example.mongodb.net/tutor_db?retryWrites=true&w=majority
```

Không commit `.env.deploy`. File này chứa secret thật và nên được đặt quyền chỉ owner đọc/ghi:

```bash
chmod 600 .env.deploy
```

Nếu có domain HTTPS:

```env
N8N_PROTOCOL=https
N8N_EDITOR_BASE_URL=https://n8n.your-domain.com
WEBHOOK_URL=https://n8n.your-domain.com/
N8N_SECURE_COOKIE=true
```

## 8. Chạy hệ thống

### 8.1 Chạy Elasticsearch và n8n

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d elasticsearch n8n
```

Backend deploy dùng MongoDB Atlas qua `SPRING_DATA_MONGODB_URI`; không cần chạy MongoDB local. MongoDB local chỉ dành cho dev/rollback và phải bật profile riêng:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile local-db up -d mongodb
```

### 8.2 Chạy Ollama embedding

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml --profile ollama up -d ollama
```

Pull model embedding:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec ollama ollama pull embeddinggemma
```

Kiểm tra:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec ollama ollama list
```

### 8.3 Build và chạy backend

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build ai-tutor-api
```

## 9. Kiểm tra sau deploy

Kiểm tra container:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
```

Backend Swagger:

```bash
curl http://localhost:8085/v3/api-docs
```

Mở browser:

```text
http://server-ip:8085/swagger-ui/index.html
http://server-ip:5678
```

Elasticsearch:

```bash
curl http://localhost:9200
```

Ollama:

```bash
curl http://localhost:11434/api/tags
```

## 10. n8n workflow

n8n phải gọi backend bằng Docker service name:

```text
http://ai-tutor-api:8085
```

Trong Docker Compose đã cấu hình:

```env
AI_TUTOR_API_BASE_URL=http://ai-tutor-api:8085
```

Các webhook FE sẽ gọi:

```text
POST /webhook/student-chat
POST /webhook/answer-review
POST /webhook/teacher-answer
POST /webhook/senior-knowledge-approval
```

Nếu test trong n8n editor thì dùng:

```text
/webhook-test/...
```

Nếu workflow active cho FE dùng thì dùng:

```text
/webhook/...
```

## 11. FE cấu hình

FE nên dùng env:

```env
VITE_N8N_BASE_URL=http://server-ip:5678
VITE_N8N_WEBHOOK_MODE=production
```

Nếu có domain HTTPS:

```env
VITE_N8N_BASE_URL=https://n8n.your-domain.com
VITE_N8N_WEBHOOK_MODE=production
```

FE không gọi OpenRouter/OpenAI trực tiếp.
FE không gọi backend AI trực tiếp nếu đang dùng n8n Harness.
FE gọi backend trực tiếp cho API nghiệp vụ, chỉ gọi n8n webhook cho AI Harness.

## 12. RAG strict behavior

Backend đã siết RAG:

- RAG chỉ trả lời theo tài liệu được upload/index theo `courseId`.
- Không trả lời ngoài tài liệu.
- Không lộ mã nguồn/project internals/API key/server config.
- Nếu tài liệu không có nội dung phù hợp thì `escalated=true`.
- `classId` dùng cho context/memory/escalation, không dùng để filter RAG.

Test đã pass:

```text
Question: mã nguồn của project là gì
Result: escalated=true, không lộ thông tin project
```

Code Mentor cũng đã siết:

- Chỉ hỗ trợ code/debug/error log.
- Không trả lời câu ngoài code/debug.
- Không làm hộ full assignment/project.

## 13. Upload tài liệu

Endpoint upload tài liệu môn học:

```text
POST /api/courses/{courseId}/materials/upload
```

Params:

```text
classId optional
teacherId required
title required
file PDF required
```

Hiện backend extract/index PDF chắc chắn. DOCX/PPT chưa nên mở cho FE nếu chưa có extractor.

Upload limits:

```text
Course material PDF: 50MB
Code upload: 2MB
Assignment/submission: 50MB
Excel import: 5MB
```

## 14. Backup Và Restore MongoDB Atlas

Job backup dùng `MONGO_BACKUP_SOURCE_URI` và tạo archive nén tại `backup/tutor_db.archive.gz`:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml \
  --profile db-tools run --rm mongo-backup
```

Restore dùng `SPRING_DATA_MONGODB_URI` làm đích:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml \
  --profile db-restore run --rm mongo-restore
```

Chỉ restore vào database trống hoặc cluster đích mới. Job không dùng `--drop` để tránh tự động xóa dữ liệu deploy. Nếu database đích đã có cùng `_id`, restore sẽ dừng và báo lỗi thay vì ghi đè âm thầm.

Thư mục `backup/` đã được git-ignore. Không commit archive hoặc URI chứa credentials.

`mongodump` chỉ backup MongoDB, gồm metadata và GridFS. Elasticsearch vector không nằm trong archive; sau khi chuyển môi trường cần reindex các material từ dữ liệu MongoDB.

## 15. Update backend sau khi sửa code

```bash
git pull

docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build ai-tutor-api
```

Xem logs:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f ai-tutor-api
```

## 16. Troubleshooting

### Backend không gọi được MongoDB

Kiểm tra env:

```env
SPRING_DATA_MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/tutor_db?retryWrites=true&w=majority
```

Kiểm tra thêm Atlas Network Access, database user và bảo đảm URI có database `/tutor_db`.

### Backend không gọi được Elasticsearch

Kiểm tra:

```bash
curl http://localhost:9200
```

Trong compose backend phải dùng:

```env
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
```

### Backend không gọi được Ollama

Kiểm tra model:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec ollama ollama list
```

Backend env:

```env
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=embeddinggemma
```

### n8n gọi backend lỗi

Trong n8n HTTP node dùng:

```text
{{$env.AI_TUTOR_API_BASE_URL}}/api/...
```

Với Docker deploy, biến này phải resolve thành:

```text
http://ai-tutor-api:8085/api/...
```

Không dùng `localhost:8085` bên trong container n8n.

### FE gọi webhook không chạy

Kiểm tra workflow đã active chưa.

Production URL:

```text
/webhook/student-chat
```

Test URL chỉ dùng khi bấm Listen for test event:

```text
/webhook-test/student-chat
```

## 17. Checklist cuối

- [ ] Docker + Compose đã cài.
- [ ] `.env.deploy` đã sửa OPENROUTER_API_KEY. Nếu có key rerank riêng thì set thêm OPENROUTER_RERANK_API_KEY, nếu không có thể để trống để dùng chung key OpenRouter.
- [ ] `SPRING_DATA_MONGODB_URI` trỏ đúng MongoDB Atlas database `tutor_db`.
- [ ] Backup Atlas one-shot chạy thành công và tạo `backup/tutor_db.archive.gz`.
- [ ] Elasticsearch chạy.
- [ ] Ollama chạy và đã pull `embeddinggemma`.
- [ ] Backend `/v3/api-docs` OK.
- [ ] n8n mở được UI.
- [ ] Workflow n8n imported và active.
- [ ] FE dùng production webhook.
- [ ] Upload thử PDF môn học.
- [ ] Test hỏi đúng tài liệu: AI trả lời.
- [ ] Test hỏi ngoài tài liệu/project internals: AI escalate, không tự trả lời.
## CORS Cho Frontend

Backend đã hỗ trợ CORS bằng biến môi trường:

```env
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

Khi deploy thật, đổi thành domain FE:

```env
APP_CORS_ALLOWED_ORIGINS=https://your-fe-domain.com,https://www.your-fe-domain.com
```

Nếu FE đang chạy Vite local:

```env
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Sau khi sửa env phải rebuild/restart backend:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build ai-tutor-api
```

## Lỗi Docker Pull EOF / Failed To Copy

Lỗi dạng:

```text
failed to copy: httpReadSeeker: failed open: failed to do request: EOF
```

Thường không phải lỗi code. Nguyên nhân hay gặp:

- Mạng tải Docker image bị ngắt.
- Docker Hub/CDN CloudFront timeout.
- Docker Desktop bị giới hạn disk/cache.
- Máy thiếu free disk trong Docker data image.
- Proxy/VPN/firewall trường học chặn hoặc cắt kết nối.

Cách xử lý:

```bash
docker pull mongo:7
docker pull elasticsearch:8.13.0
docker pull docker.n8n.io/n8nio/n8n:latest
docker pull ollama/ollama:latest
```

Nếu lỗi, retry từng image vài lần.

Kiểm tra dung lượng Docker:

```bash
docker system df
```

Dọn cache build/image rác, không xóa volume:

```bash
docker image prune -f
docker builder prune -f
```

Không chạy lệnh này nếu đã có data thật:

```bash
docker system prune -a --volumes
```

Vì nó có thể xóa volume MongoDB, Elasticsearch, n8n workflow và Ollama model.

Nếu dùng Docker Desktop trên Windows, tăng resource trong Settings:

```text
Memory: 8GB hoặc hơn
Disk image size: 80GB+
CPU: 4 cores+
```

Máy 16GB vẫn có thể pull được nếu Docker còn đủ disk và mạng ổn. Máy 32GB chạy được có thể vì Docker Desktop được cấp resource/disk tốt hơn hoặc mạng ổn hơn lúc retry.
