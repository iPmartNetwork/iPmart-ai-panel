#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="iPmart AI"
APP_SLUG="ipmart-ai-panel"

DEFAULT_INSTALL_DIR="/opt/${APP_SLUG}"
DEFAULT_REPO_URL="https://github.com/iPmartNetwork/iPmart-ai-panel.git"

# 🔥 Pinned versions (important)
OLLAMA_VERSION_DEFAULT="0.20.6"
DEFAULT_MODEL="qwen2.5-coder:7b"

OPENWEBUI_PORT="3000"
OLLAMA_PORT="11434"

# Colors
log() { echo -e "\033[0;34m[*]\033[0m $*"; }
ok()  { echo -e "\033[0;32m[+]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[!]\033[0m $*"; }
err() { echo -e "\033[0;31m[-]\033[0m $*" >&2; }

trap 'err "Error on line $LINENO"' ERR

require_root() {
  [[ "$EUID" -eq 0 ]] || { err "Run as root"; exit 1; }
}

ask() {
  read -rp "$1 [$2]: " v
  echo "${v:-$2}"
}

ask_secret() {
  read -rsp "$1: " v
  echo
  echo "$v"
}

install_base() {
  log "Installing base packages..."
  apt update -y
  apt install -y curl git nginx certbot python3-certbot-nginx \
    ca-certificates gnupg lsb-release ufw jq
  ok "Base packages installed"
}

install_docker() {
  if command -v docker &>/dev/null; then
    ok "Docker already installed"
    return
  fi

  log "Installing Docker..."

  install -m 0755 -d /etc/apt/keyrings

  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release

  echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $VERSION_CODENAME stable" \
  > /etc/apt/sources.list.d/docker.list

  apt update -y
  apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

  systemctl enable docker
  systemctl start docker

  ok "Docker installed"
}

install_ollama() {
  local version="$1"

  if command -v ollama &>/dev/null; then
    ok "Ollama already installed"
  else
    log "Installing Ollama v${version}..."
    curl -fsSL https://ollama.com/install.sh | OLLAMA_VERSION="$version" sh
  fi

  log "Configuring Ollama..."

  mkdir -p /etc/systemd/system/ollama.service.d

  cat > /etc/systemd/system/ollama.service.d/override.conf <<EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:${OLLAMA_PORT}"
EOF

  systemctl daemon-reexec
  systemctl daemon-reload
  systemctl enable ollama
  systemctl restart ollama

  sleep 3

  curl -fsS http://127.0.0.1:${OLLAMA_PORT}/api/tags >/dev/null

  ok "Ollama running on ${OLLAMA_PORT}"
}

pull_model() {
  local model="$1"
  log "Pulling model: $model"
  ollama pull "$model"
  ok "Model ready"
}

setup_repo() {
  local use_current="$1"
  local dir="$2"
  local repo="$3"

  if [[ "$use_current" == "yes" ]]; then
    REPO_DIR=$(pwd)
  else
    rm -rf "$dir"
    git clone "$repo" "$dir"
    REPO_DIR="$dir"
  fi

  ok "Repository ready: $REPO_DIR"
}

validate_files() {
  for f in \
    docker-compose.yml \
    deploy/nginx/ipmart-ai.conf \
    theme/ipmart-theme.css \
    theme/ipmart-theme.js \
    public/manifest.webmanifest
  do
    [[ -f "$REPO_DIR/$f" ]] || { err "Missing $f"; exit 1; }
  done

  ok "All required files exist"
}

write_env() {
  cat > "$REPO_DIR/.env" <<EOF
DOMAIN=$DOMAIN
WEBUI_URL=https://$DOMAIN

WEBUI_ADMIN_NAME=$ADMIN_NAME
WEBUI_ADMIN_EMAIL=$ADMIN_EMAIL
WEBUI_ADMIN_PASSWORD=$ADMIN_PASS

OLLAMA_BASE_URL=http://host.docker.internal:$OLLAMA_PORT
OLLAMA_MODEL=$MODEL

ENABLE_SIGNUP=False
ENABLE_PERSISTENT_CONFIG=False
BYPASS_MODEL_ACCESS_CONTROL=False
EOF
}

start_stack() {
  log "Starting Open WebUI..."

  cd "$REPO_DIR"
  docker compose up -d

  log "Waiting for Open WebUI..."

  for i in {1..30}; do
    if curl -s http://127.0.0.1:$OPENWEBUI_PORT >/dev/null; then
      ok "Open WebUI is ready"
      return
    fi
    sleep 2
  done

  err "Open WebUI failed to start"
  exit 1
}

setup_nginx() {
  log "Configuring Nginx..."

  sed \
    -e "s|\${INSTALL_DIR}|$REPO_DIR|g" \
    -e "s|\${DOMAIN}|$DOMAIN|g" \
    "$REPO_DIR/deploy/nginx/ipmart-ai.conf" \
    > /etc/nginx/sites-available/ipmart-ai.conf

  ln -sf /etc/nginx/sites-available/ipmart-ai.conf \
         /etc/nginx/sites-enabled/ipmart-ai.conf

  rm -f /etc/nginx/sites-enabled/default

  nginx -t
  systemctl restart nginx

  ok "Nginx configured"
}

setup_firewall() {
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
  ufw --force enable || true
}

setup_ssl() {
  log "Checking DNS..."

  if ! getent hosts "$DOMAIN" >/dev/null; then
    warn "Domain not pointing to this server yet!"
    warn "Skipping SSL. Run later:"
    warn "certbot --nginx -d $DOMAIN"
    return
  fi

  log "Installing SSL..."

  certbot --nginx -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$EMAIL" \
    --redirect || true
}

summary() {
  echo
  echo "===================================="
  ok "Installation Completed"
  echo "===================================="
  echo "URL: https://$DOMAIN"
  echo "Model: $MODEL"
  echo "Ollama Version: $OLLAMA_VERSION"
  echo "===================================="
}

# ===== MAIN =====

require_root

echo "=== iPmart AI Installer ==="

USE_CURRENT="yes"
read -rp "Use current directory? [Y/n]: " a
[[ "$a" =~ ^[Nn]$ ]] && USE_CURRENT="no"

INSTALL_DIR=$(ask "Install directory" "$DEFAULT_INSTALL_DIR")
REPO_URL=$(ask "Repository URL" "$DEFAULT_REPO_URL")

DOMAIN=$(ask "Domain (example: ai.example.com)" "")
EMAIL=$(ask "SSL Email" "")
ADMIN_NAME=$(ask "Admin Name" "Admin")
ADMIN_EMAIL=$(ask "Admin Email" "")
ADMIN_PASS=$(ask_secret "Admin Password")

OLLAMA_VERSION=$(ask "Ollama version" "$OLLAMA_VERSION_DEFAULT")
MODEL=$(ask "Model" "$DEFAULT_MODEL")

install_base
install_docker
install_ollama "$OLLAMA_VERSION"
pull_model "$MODEL"

setup_repo "$USE_CURRENT" "$INSTALL_DIR" "$REPO_URL"
validate_files
write_env
start_stack
setup_nginx
setup_firewall
setup_ssl

summary