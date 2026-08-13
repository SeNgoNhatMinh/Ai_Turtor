# AI Tutor Platform

This repository contains the frontend and backend of the AI Tutor platform.

## Repository layout

```text
.
|-- src/                 React frontend source
|-- public/              Frontend static assets
|-- tests/               Frontend tests
|-- docs/                Frontend and product documentation
`-- ai-tutor-api/        Spring Boot backend and n8n workflows
```

## Frontend

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:5173`.

## Backend

Requirements: Java 17, Maven, MongoDB, and Elasticsearch.

```bash
cd ai-tutor-api
mvn spring-boot:run
```

The backend runs at `http://localhost:8085`. Deployment and environment details
are documented in `ai-tutor-api/README.md` and
`ai-tutor-api/AI_TUTOR_DEPLOY_HANDOFF.md`.

## Verification

```bash
npm run check
cd ai-tutor-api && mvn test
```

Environment files, Maven output, logs, backups, and runtime data are excluded
from Git. Use the committed `.env.*.example` files as configuration templates.
