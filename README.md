# AI Tutor Platform

This repository contains the frontend and backend of the AI Tutor platform.

## Repository layout

```text
.
|-- AI_Turtor_FE/        React frontend, tests, and frontend documentation
`-- AI-tutor/            Spring Boot backend and n8n workflows
```

## Frontend

Requirements: Node.js and npm.

```bash
cd AI_Turtor_FE
npm install
npm run dev
```

The development server runs at `http://localhost:5173`.

## Backend

Requirements: Java 17, Maven, MongoDB, and Elasticsearch.

```bash
cd AI-tutor
mvn spring-boot:run
```

The backend runs at `http://localhost:8085`. Deployment and environment details
are documented in `AI-tutor/README.md` and
`AI-tutor/AI_TUTOR_DEPLOY_HANDOFF.md`.

## Verification

```bash
cd AI_Turtor_FE
npm run check
cd ../AI-tutor
mvn test
```

Environment files, Maven output, logs, backups, and runtime data are excluded
from Git. Use the committed `.env.*.example` files as configuration templates.
