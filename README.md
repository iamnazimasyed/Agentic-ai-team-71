# CAMPUS-X

CAMPUS-X is a multi-agent emergency response and resource coordination system for campus incidents.

## Phase 1: Project bootstrap

This phase sets up the initial workspace, backend API skeleton, frontend dashboard shell, environment configuration, and project documentation.

## Project structure

```text
campus-x/
├── backend/
│   ├── app/
│   │   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tools/
│   │   ├── database/
│   │   ├── graph/
│   │   └── data/
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   └── ...
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── demo-scenario.md
├── .gitignore
├── docker-compose.yml
├── README.md
└── .env.example
```

## Backend setup

```bash
cd campus-x/backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

```bash
cd campus-x/frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

## Docker

```bash
cd campus-x
docker compose up --build
```

## Expected result

- Backend health endpoint: http://localhost:8000/health
- Frontend application: http://localhost:5173
- PostgreSQL service on port 5432

## Testing

```bash
cd campus-x/backend
python -m pytest

cd campus-x/frontend
npm run build
```

## Notes

This is a starter scaffold for the full CAMPUS-X system. The next phases will build the incident models, AI agents, routing engine, human approval workflow, and dashboard functionality.

## Phase 13: deployment and environment hardening

This phase adds containerized deployment wiring, environment-aware configuration, health checks, and deployment documentation so the platform is closer to a production-ready local stack.

## Deployment overview

The project now supports a local dockerized stack with:

- PostgreSQL for persistence
- FastAPI backend
- React frontend

## Docker workflow

```bash
cd campus-x
docker compose up --build
```

## Services

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/health
- PostgreSQL: localhost:5432

## Environment files

- Backend uses `.env` in `backend/` when present.
- Frontend uses `.env` in `frontend/` when present.
- Compose injects runtime variables directly for local orchestration.

## Production notes

- Prefer managed PostgreSQL in production instead of the local `postgres` container.
- Keep secrets out of source control.
- Use a reverse proxy or ingress layer for public traffic.
- Pin versions for all runtime dependencies.

## Monitoring and health checks

The Compose stack includes health checks for PostgreSQL and the backend API route `/health`.

## Related docs

See `docs/deployment.md` for the environment and deployment guide.
