# 3PL Web Incident Recovery Runbook

This runbook is for restarting `3pl-web` after the 2026-04-24 web-container compromise.

## 1. Non-negotiable rules
- Do not restart the previously compromised `3pl-web` container.
- Do not reuse the previously built `app-web` image or its layers.
- Rotate secrets before restoring external access.
- Keep the preserved forensic bundle outside the new runtime path.

## 2. Required completion criteria before opening traffic
- Patched images are rebuilt from current source.
- `3pl-web` and `3pl-api` run from fresh containers.
- Rotated values are applied for:
  - MySQL root password
  - MySQL app user password
  - `JWT_SECRET`
  - admin password
  - CI/CD and deployment secrets
- Health checks pass:
  - `http://127.0.0.1:3100/health`
  - `http://127.0.0.1:3000/login`
- Web login works with the rotated admin account.

## 3. Pre-flight checklist
- Confirm the old web container is still stopped.
- Prepare a fresh env file such as `docker.env.incident`.
- Fill `docker.env.incident` with newly generated values.
- Confirm reverse proxy or load balancer still points to `127.0.0.1:3000`.
- Confirm IOC blocks are in place for known malicious IPs.

## 4. Redeploy sequence
1. Rotate database and application secrets.
2. Rebuild images with `--no-cache`.
3. Recreate `api` and `web` with the new env file.
4. Verify local health and login.
5. Re-enable public traffic only after checks pass.

## 5. Recommended post-start checks
- `docker compose --env-file docker.env.incident ps`
- `docker compose --env-file docker.env.incident logs --tail=200 web api`
- Confirm no unexpected child process execution in `web`.
- Confirm no outbound calls to unknown hosts from `web` or `api`.
