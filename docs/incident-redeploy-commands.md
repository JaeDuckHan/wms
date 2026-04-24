# 3PL Web Redeploy Commands

These commands assume you are running them from the repository root on the deployment host.

## 1. Build fresh images
```powershell
docker compose --env-file docker.env.incident build --no-cache api web
```

## 2. Stop and remove compromised web container
```powershell
docker compose --env-file docker.env.incident stop web
docker compose --env-file docker.env.incident rm -f web
```

## 3. Recreate API with rotated secrets
Do this after rotating the MySQL app password and `JWT_SECRET`.

```powershell
docker compose --env-file docker.env.incident up -d --force-recreate --no-deps api
```

## 4. Recreate web from the rebuilt image
```powershell
docker compose --env-file docker.env.incident up -d --force-recreate --no-deps web
```

## 5. Verify container status and logs
```powershell
docker compose --env-file docker.env.incident ps
docker compose --env-file docker.env.incident logs --tail=200 api
docker compose --env-file docker.env.incident logs --tail=200 web
```

## 6. Verify local health
```powershell
curl.exe http://127.0.0.1:3100/health
curl.exe http://127.0.0.1:3000/login
```

## 7. Optional clean restart of both services
```powershell
docker compose --env-file docker.env.incident up -d --force-recreate --no-deps api web
```

## 8. Rollback rule
- Do not roll back to the previously compromised `app-web` image.
- If validation fails, keep `web` stopped and investigate using the rebuilt image only.
