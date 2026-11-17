#!/usr/bin/env bash
# Starts Caliper with demonstration data and exposes a public HTTPS preview via Cloudflare Tunnel.
# Prerequisites: Docker daemon running, Java 21, Maven, Node.js 20+, and cloudflared.
# Demonstration accounts are public (refer to README.md). Do not use with sensitive student data.
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.local/share/apache-maven-3.9.9/bin:$PATH"
cd "$(dirname "$0")/.."
[ -f .env ] || { cp .env.example .env; sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|; s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env; }
set -a; . ./.env; set +a
docker compose up -d
./scripts/build-sandbox-images.sh
mvn -B -q -DskipTests package
(cd frontend && npm ci && VITE_DEMO=true npm run build)
export STATIC_DIR="$PWD/frontend/dist" SEED_DEMO=true FORWARD_HEADERS=framework
java -jar backend/target/codesentinel-backend-0.1.0.jar & APP=$!
trap 'kill $APP 2>/dev/null' EXIT
until curl -fs http://127.0.0.1:8080/actuator/health >/dev/null; do sleep 2; done
echo "Local: http://127.0.0.1:8080   (login: demo-instructor@demo.invalid / demo-password-1)"
exec cloudflared tunnel --edge-ip-version 6 --url http://127.0.0.1:8080
