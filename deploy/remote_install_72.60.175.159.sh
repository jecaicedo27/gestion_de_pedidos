#!/usr/bin/env bash
# Helper script with the exact commands to run on the remote server (Ubuntu 20.04/22.04).
# Usage on the remote host (after SSH login as root):
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/jecaicedo27/gestion_de_pedidos/main/deploy/remote_install_72.60.175.159.sh)"
#
# Or copy/paste the blocks below manually.

set -Eeuo pipefail

# --- PARAMETERS (adjust if needed) ---
export GP_PUBLIC_HOST=72.60.175.159
export GP_DB_NAME=gestion_pedidos_dev
export GP_DB_USER=gp_user
# Choose a strong DB password (do NOT reuse your SSH/root password)
export GP_DB_PASS='Gp!2025_prod#'
# Branch to deploy (default: main)
export GP_BRANCH=main
# Optional: backend port (defaults to 3001 in the installer)
# export GP_BACKEND_PORT=3001

echo "[REMOTE-INSTALL] Starting end-to-end installation for Gestion de Pedidos"
echo "[REMOTE-INSTALL] Host: ${GP_PUBLIC_HOST}  DB: ${GP_DB_NAME}/${GP_DB_USER}"

# --- Download and run the official end-to-end installer from GitHub ---
curl -fsSL https://raw.githubusercontent.com/jecaicedo27/gestion_de_pedidos/main/deploy/install_end_to_end.sh -o /tmp/install_gp.sh
chmod +x /tmp/install_gp.sh

# Run as root (you are root), with env vars applied
bash /tmp/install_gp.sh

# --- Post-install hardening: disable SIIGO initially to avoid rate-limit/auth noise in production bootstrap ---
# The installer writes backend/.env with SIIGO_ENABLED=true; flip to false initially.
if [ -f /var/www/gestion_de_pedidos/backend/.env ]; then
  sed -i 's/^SIIGO_ENABLED=true/SIIGO_ENABLED=false/' /var/www/gestion_de_pedidos/backend/.env || true
  # Reload backend with new env
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart gestion-backend --update-env || true
    pm2 save || true
  fi
fi

# --- Health checks ---
echo "[REMOTE-INSTALL] Local health via Nginx proxy:"
curl -s -i "http://127.0.0.1/api/health" || true
echo
echo "[REMOTE-INSTALL] If you see 502, check backend port and Nginx config:"
echo "  curl -i http://127.0.0.1:3001/api/health"

cat <<'EON'
========================================================
✅ Installation steps finished

Test from your browser:
  Frontend:  http://72.60.175.159/
  API Health: http://72.60.175.159/api/health

Operational notes:
- Backend is managed by PM2:
    pm2 logs gestion-backend --lines 120
    pm2 restart gestion-backend --update-env
- Frontend is served by Nginx from /var/www/gestion-frontend
- To enable SIIGO later:
    sed -i 's/^SIIGO_ENABLED=false/SIIGO_ENABLED=true/' /var/www/gestion_de_pedidos/backend/.env
    pm2 restart gestion-backend --update-env

Security:
- Keep GP_DB_PASS secret and different from SSH/root password.
========================================================
EON
