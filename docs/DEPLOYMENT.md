# Deploying Caliper

Caliper can be deployed either locally for demonstrations and evaluation, or on a dedicated server (Ubuntu 22.04/24.04 VM, AWS, GCP, or bare metal). Both deployment topologies place the complete application (Web UI, REST API, and Background Judge Worker) behind a single unified port (8080 by default), where the Spring Boot backend directly serves the pre-compiled frontend Single Page Application (`STATIC_DIR`).

---

## 1. What Has Been Verified

- **Full Local & CI Verification**:
  - Backend serving `frontend/dist` with client-side SPA routing (`/dashboard`, `/courses`, `/similarity`, `/workspace`).
  - Strict security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
  - Per-IP rate limiting returning HTTP `429 Too Many Requests` on abuse.
  - Multi-language sandboxed execution inside Docker runner containers across Linux and Windows.
  - Plagiarism dual-engine benchmark (100% precision, 100% recall on synthetic ground-truth).
  - 200 backend/engine/judge unit & integration tests passing (`mvn test`: 75 engine, 50 judge, 75 backend).
  - 40 frontend unit & component tests passing (`npm test`) — 240 passing tests total.
  - GitHub Actions CI workflow passing with green checks on Ubuntu and Windows matrix runners.

---

## 2. Deployment Option A: Local Demonstration & Evaluation

Ideal for presentations, demonstrations, or academic evaluations:

### Step 1: Ensure Prerequisites Are Installed
- Docker Engine / Docker Desktop
- Java JDK 21+
- Apache Maven 3.9+
- Node.js 20+

### Step 2: Build Sandbox Runner Images
```bash
./scripts/build-sandbox-images.sh
```
*(On Windows PowerShell: `.\scripts\windows\build-sandbox-images.ps1`)*

### Step 3: Launch Local Demo
```bash
bash deploy/presentation.sh
```
This builds both frontend and backend, sets `APP_SEED_DEMO=true`, initializes PostgreSQL (via Docker Compose), applies Flyway migrations, and starts the platform on `http://localhost:8080`.

Demo Accounts:
- **Instructor**: `demo-instructor@demo.invalid` / `demo-password-1`
- **Students**: `student1@demo.invalid`, `student2@demo.invalid`, `student3@demo.invalid` / `demo-password-1`

---

## 3. Deployment Option B: Production Server (Ubuntu 22.04 / 24.04 LTS)

For institutional deployments hosting live courses:

### Step 1: Provision Server & Open Ports
Open inbound ports `22` (SSH), `80` (HTTP), and `443` (HTTPS).

### Step 2: Clone Repository & Execute Installer
```bash
git clone https://github.com/HARSH4885-svg/Caliper-College-Team.git /opt/codesentinel
cd /opt/codesentinel
sudo bash deploy/install-ubuntu.sh your-institution-domain.edu
```
The installer script:
1. Provisions system dependencies (Java 21, Docker, PostgreSQL 16, Caddy web server).
2. Generates cryptographically random JWT secrets.
3. Builds the production runner containers (`codesentinel/runner-*`).
4. Compiles the backend and packages the production frontend.
5. Installs and enables the `codesentinel.service` systemd daemon.
6. Configures automated nightly database backups via cron.

---

## 4. Production Environment Configuration (`/etc/caliper/prod.env`)

```ini
# Application Secrets
JWT_SECRET=<64-char-cryptographically-random-string>
SERVER_PORT=8080

# Relational Database
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/caliper_prod
SPRING_DATASOURCE_USERNAME=caliper_app
SPRING_DATASOURCE_PASSWORD=<secure-database-password>

# File Storage
STORAGE_PROVIDER=local
STORAGE_ROOT=/var/lib/caliper/storage

# Container Sandbox Execution
CALIPER_DOCKER_BIN=docker
CALIPER_SANDBOX_RUNTIME=docker
CALIPER_JUDGE_WORK_ROOT=/var/lib/caliper/judge

# Production Security Flags
STATIC_DIR=/opt/caliper/frontend/dist
RATE_LIMIT_PER_MINUTE=60
REGISTRATION_ENABLED=false
APP_SEED_DEMO=false
```

---

## 5. Operations & Maintenance

### Service Management
```bash
# Check service status
sudo systemctl status codesentinel

# View live application and worker logs
sudo journalctl -u codesentinel -f

# Restart application
sudo systemctl restart codesentinel
```

### Health Inspection
```bash
curl http://127.0.0.1:8080/actuator/health
```

### Updating to Latest Release
```bash
cd /opt/codesentinel
git pull origin main
mvn clean package -DskipTests
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart codesentinel
```

### Automated Backups
Automated database backups are created daily at 02:00 UTC and stored in `/var/backups/codesentinel/` with 14-day retention.
To trigger an immediate manual snapshot:
```bash
sudo bash deploy/backup.sh
```

### Disaster Recovery & Restore Drill
To restore the PostgreSQL database and submission storage from a backup archive:

```bash
# 1. Restore the database into an empty database
gunzip -c /var/backups/codesentinel/db-<STAMP>.sql.gz | docker exec -i codesentinel-postgres psql -U codesentinel -d codesentinel

# 2. Extract storage assets back to the storage root
tar -xzf /var/backups/codesentinel/storage-<STAMP>.tar.gz -C /var/lib/codesentinel

# 3. Restart the backend service
sudo systemctl restart codesentinel
```
