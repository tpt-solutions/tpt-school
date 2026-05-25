#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────────────────────────────
# TPT School — One-step deploy wizard
# ──────────────────────────────────────────────────────────────────────

BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RESET="\033[0m"

echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}  ║       TPT School — Deploy Wizard      ║${RESET}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Check prerequisites ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}Node.js is not installed. Installing Node.js 20...${RESET}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v npm &>/dev/null; then
  echo -e "${YELLOW}npm not found — exiting.${RESET}"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo -e "${YELLOW}Node.js version must be 20+. Found: $(node -v).${RESET}"
  exit 1
fi

# ── 2. Environment ───────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${CYAN}Created .env from .env.example${RESET}"
fi

# Generate AUTH_SECRET if still placeholder
if grep -q "replace-with-a-strong-random-secret-in-production" .env 2>/dev/null; then
  SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|replace-with-a-strong-random-secret-in-production|$SECRET|" .env
  else
    sed -i "s|replace-with-a-strong-random-secret-in-production|$SECRET|" .env
  fi
  echo -e "${GREEN}Generated AUTH_SECRET${RESET}"
fi

# Prompt for NEXTAUTH_URL
CURRENT_URL=$(grep NEXTAUTH_URL .env | cut -d= -f2-)
echo -e "${BOLD}Enter the public URL for this deployment${RESET}"
echo -e "  (e.g. https://school.example.com or http://your-vps-ip:3000)"
echo -e "  Press Enter to keep: ${CYAN}${CURRENT_URL}${RESET}"
read -r URL_INPUT
if [ -n "$URL_INPUT" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=$URL_INPUT|" .env
  else
    sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=$URL_INPUT|" .env
  fi
  echo -e "${GREEN}NEXTAUTH_URL updated to $URL_INPUT${RESET}"
fi

echo -e "${GREEN}.env is ready${RESET}"
echo ""

# ── 3. Install dependencies ──────────────────────────────────────────
echo -e "${CYAN}Installing dependencies...${RESET}"
npm ci --omit=dev 2>&1 | tail -1
echo ""

# ── 4. Database migrations ───────────────────────────────────────────
echo -e "${CYAN}Running database migrations...${RESET}"
npx prisma generate 2>&1 | tail -1
npx prisma migrate deploy 2>&1 | tail -1
echo ""

# ── 5. Build ─────────────────────────────────────────────────────────
echo -e "${CYAN}Building...${RESET}"
npm run build 2>&1 | tail -1
echo ""

# ── 6. Start ─────────────────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo -e "${CYAN}Starting with pm2...${RESET}"
  pm2 delete tpt-school 2>/dev/null || true
  pm2 start .next/standalone/server.js --name tpt-school
  pm2 save
  pm2 startup 2>&1 | tail -5
else
  echo -e "${YELLOW}pm2 not found. Starting with node (will stop on shell exit).${RESET}"
  echo -e "${YELLOW}Install pm2 for auto-restart: npm install -g pm2 && pm2 startup${RESET}"
  echo ""
  nohup node .next/standalone/server.js > tpt-school.log 2>&1 &
  echo -e "${GREEN}Server started in background — logs: tail -f tpt-school.log${RESET}"
fi

echo ""
echo -e "${GREEN}${BOLD}  ✅ Deploy complete!${RESET}"
echo -e "     Your app is running at: ${CYAN}$(grep NEXTAUTH_URL .env | cut -d= -f2-)${RESET}"
echo ""