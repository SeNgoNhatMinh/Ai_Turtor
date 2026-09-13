# API and state contracts
- Read .agents/references/api-contract.md and the exact touched repository/controller.
- Preserve springDioProvider vs n8nDioProvider separation and n8n base-path normalization.
- JWT is required by current auth persistence; never revert to the obsolete no-token example.
- Preserve n8n context fields and timeouts; no sensitive payload logging.
- Do not swap course ID/code, class ID, user ID or role strings globally.
- Preserve 401 handling, request cancellation, optimistic reconciliation and websocket dispose.
- Do not move network work into presentation or invent backend endpoints from documentation examples.
