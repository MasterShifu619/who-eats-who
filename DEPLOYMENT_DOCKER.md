# Docker Deployment Notes

## Files Added

- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `docker-compose.yml`

## Local Build/Run (Laptop)

Set the frontend API URL before building so browser clients call the correct backend host.

PowerShell example (same laptop):

```powershell
$env:NEXT_PUBLIC_API_URL="http://localhost:8000"
docker compose build
docker compose up -d
```

For iPad testing on the same network:

```powershell
$env:NEXT_PUBLIC_API_URL="http://<laptop-lan-ip>:8000"
docker compose build
docker compose up -d
```

## Cloud/Kubernetes Notes

- Frontend image needs `NEXT_PUBLIC_API_URL` at build time (public API URL).
- Backend listens on `0.0.0.0:8000`.
- Frontend listens on `0.0.0.0:3000`.
- Current backend CORS is open (`allow_origins=["*"]`) in `backend/main.py`.

Example cloud value:

```text
NEXT_PUBLIC_API_URL=https://api.your-domain.example
```
