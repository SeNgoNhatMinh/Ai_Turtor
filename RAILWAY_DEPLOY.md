# Railway Deployment Plan

## 1. Repository layout

Railway deploys the two applications from one Git repository:

```text
Ai_Turtor_FE/   # React/Vite frontend
AI_Turtor_BE/   # Spring Boot Java 17 backend and n8n workflow files
```

Use these exact Railway Root Directories:

- Frontend: `/Ai_Turtor_FE`
- Backend: `/AI_Turtor_BE`

Create all services in the same Railway project and name them exactly:

- `frontend`
- `backend`
- `elasticsearch`
- `n8n`

This keeps Railway reference variables in this guide valid.

## 2. Prerequisites

Prepare these values before deploying:

- MongoDB Atlas URI for database `tutor_db`.
- A strong JWT secret of at least 64 random characters.
- Strong initial admin and Swagger passwords.
- Hosted LLM and embedding API keys used by the backend.
- A fixed random `N8N_ENCRYPTION_KEY`.

Do not commit any real key, password, Atlas URI, `.env`, local config, dump, or log.

## 3. Deploy Elasticsearch

1. Add a service from Docker image `elasticsearch:8.13.0`.
2. Name it `elasticsearch`.
3. Set variables:

```env
discovery.type=single-node
xpack.security.enabled=false
ES_JAVA_OPTS=-Xms512m -Xmx512m
```

4. Attach a Railway Volume at `/usr/share/elasticsearch/data`.
5. Keep it private; it does not need a public domain.
6. The internal application port is `9200`.

## 4. Deploy the backend

1. Add a GitHub service from this repository.
2. Name it `backend`.
3. Set Root Directory to `/AI_Turtor_BE`.
4. Railway will build the existing Java 17 Dockerfile.
5. Generate a public domain.
6. Set Healthcheck Path to `/actuator/health`.
7. Paste variables in the service Raw Editor, replacing placeholders:

```env
PORT=8085
JAVA_OPTS=-Xms256m -Xmx768m
SPRING_DATA_MONGODB_URI=<mongodb-atlas-uri>
ELASTICSEARCH_HOST=${{elasticsearch.RAILWAY_PRIVATE_DOMAIN}}
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_INDEX=course_material_vectors_nemotron_2048

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

Enable only providers for which a valid API key is configured. Do not deploy Ollama
inside the initial Railway setup; its memory and model storage requirements are much
higher than hosted API providers.

Verify:

- `https://<backend-domain>/actuator/health`
- `https://<backend-domain>/v3/api-docs`
- Login through `POST https://<backend-domain>/api/users/login`

## 5. Deploy n8n

1. Add a service from Docker image `docker.n8n.io/n8nio/n8n:latest`.
2. Name it `n8n`.
3. Generate a public domain for the editor and browser webhooks.
4. Attach a Railway Volume at `/home/node/.n8n` so workflows and credentials survive redeploys.
5. Set variables:

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

6. Open the n8n public domain and create the owner account.
7. Import and activate these files from `AI_Turtor_BE/n8n-import/docker-ready/`:

```text
AI-tutor-workflow-runtime-fixed.json
AI-tutor-v2-proactive-workflows.json
AI-tutor-teacher-ai-grading.json
```

8. Confirm every backend HTTP node forwards the incoming `Authorization` header.
9. Use production `/webhook/...` URLs, not `/webhook-test/...` URLs.

For a single demo instance, n8n's database on the attached volume is sufficient.
Use a Railway Postgres service before scaling n8n to multiple replicas.

## 6. Deploy the frontend

1. Add another GitHub service from this repository.
2. Name it `frontend`.
3. Set Root Directory to `/Ai_Turtor_FE`.
4. Railway will build the frontend Dockerfile and serve the SPA with Caddy.
5. Generate a public domain.
6. Set Healthcheck Path to `/health`.
7. Initially deploy with backend-direct mode:

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

`VITE_*` variables are embedded at build time. Redeploy the frontend whenever one
of them changes.

## 7. Enable n8n flows progressively

After backend-direct login, chat, quiz, materials, and WebSocket tests pass:

1. Test the Student Chat production webhook directly in n8n.
2. Set `VITE_N8N_ENABLED=true` and redeploy frontend.
3. Test RAG, CODE, ESCALATE, teacher final answer, and senior approve/reject.
4. Enable quiz only after its response contract passes:
   `VITE_N8N_QUIZ_ENABLED=true`.
5. Enable teacher assignment grading only after its workflow passes:
   `VITE_N8N_ASSIGNMENT_GRADING_ENABLED=true`.
6. Enable Tutor V2 only after all V2 webhooks pass:
   `VITE_N8N_TUTOR_V2_ENABLED=true`.
7. Keep `VITE_N8N_STRICT=false` during smoke tests. Set it to `true` only when no
   backend fallback is desired.

## 8. Final smoke test

- Login all roles: `STUDENT`, `TEACHER`, `SENIOR_MENTOR`, `ADMIN`.
- Refresh nested frontend routes; Caddy must return the React application, not 404.
- Confirm API CORS from the frontend public domain.
- Confirm `/ws/chat` and `/ws/events` connect over `wss://`.
- Student chat: RAG, CODE, ESCALATE, history, pin persistence, and 10-question rollover.
- Student quiz: generate, submit, result review, and assigned quiz.
- Teacher: publish quiz/assignment, review attempt, and escalation flow.
- Senior/Admin: knowledge approval/rejection and Tutor V2 review.
- Admin: PDF upload, URL import, indexing status, academic CRUD, and AI logs.
- Restart `n8n` and `elasticsearch`; data must remain because volumes are attached.
