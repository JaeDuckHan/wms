# Secret Rotation Checklist After 3PL Web Compromise

Treat every secret that the web tier could read or use as exposed.

## 1. Rotate immediately
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD` for `${MYSQL_USER}`
- `JWT_SECRET`
- admin user password
- deployment host SSH keys or deployment tokens if stored on the host
- CI/CD secrets used to build or deploy this stack
- registry credentials if stored on the deployment host

## 2. Prepare new values
Use PowerShell to generate strong replacement values:

```powershell
function New-Secret([int]$Bytes = 48) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  [Convert]::ToBase64String($buffer)
}

New-Secret 48   # JWT_SECRET
New-Secret 32   # MYSQL_ROOT_PASSWORD
New-Secret 32   # MYSQL_PASSWORD
New-Secret 24   # ADMIN_PASSWORD
```

## 3. Update env file
Create a fresh deployment env file and fill in only new values:

```powershell
Copy-Item docker.env.example docker.env.incident
```

## 4. Rotate MySQL credentials on the running DB
First inspect the current user/host entries:

```powershell
docker exec -it 3pl-db mysql -uroot -pOLD_ROOT_PASSWORD -e "SELECT user, host FROM mysql.user ORDER BY user, host;"
```

Then rotate passwords for the matching entries:

```powershell
docker exec -it 3pl-db mysql -uroot -pOLD_ROOT_PASSWORD -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'NEW_ROOT_PASSWORD';"
docker exec -it 3pl-db mysql -uroot -pOLD_ROOT_PASSWORD -e "ALTER USER 'root'@'%' IDENTIFIED BY 'NEW_ROOT_PASSWORD';"
docker exec -it 3pl-db mysql -uroot -pOLD_ROOT_PASSWORD -e "ALTER USER 'wms_user'@'%' IDENTIFIED BY 'NEW_APP_PASSWORD'; FLUSH PRIVILEGES;"
```

If `wms_user` uses a different host than `%`, replace the host accordingly.

## 5. Rotate application credentials
- Update `JWT_SECRET` in `docker.env.incident`
- Update `ADMIN_PASSWORD` in `docker.env.incident`
- Update the same values in:
  - CI/CD secret store
  - deployment automation
  - password vault / runbook references

## 6. Validate after restart
- API starts with the new DB password
- login works only with the new admin password
- old JWTs no longer authenticate after `JWT_SECRET` rotation
