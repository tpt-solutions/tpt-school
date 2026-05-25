# TPT School

A school management system built with [Next.js](https://nextjs.org), [Prisma](https://prisma.io), and [SQLite](https://sqlite.org). Tracks students, classes, attendance, grades, and more.

## Features

- **Student management** — enroll, edit, and archive students
- **Class scheduling** — create and manage classes with assigned teachers
- **Attendance tracking** — mark and view attendance per class/student
- **Grading** — record and calculate grades
- **Reports** — export report cards and summaries (PDF)
- **Authentication** — secure login via NextAuth

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local development

```bash
# Install dependencies
npm ci

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### One-step wizard (recommended)

SSH into any Linux server (Ubuntu recommended), clone the repo, and run:

```bash
git clone https://github.com/PhillipC05/tpt-school.git
cd tpt-school
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Install Node.js if missing
2. Create your `.env` and generate a secure `AUTH_SECRET`
3. Ask you for the public URL (e.g. `https://school.example.com`)
4. Install dependencies, run migrations, and build
5. Start the app with pm2 (auto-restart on reboot)

That's it — your app is live. The deploy wizard works on any VPS from any provider.

### Docker

```bash
docker compose up -d --build
```

The app will be available on port `3000` with the SQLite database persisted in a Docker volume. Override `AUTH_SECRET` and `NEXTAUTH_URL` in `docker-compose.yml` for production.

### VPS (manual)

A cheap VPS is the most practical way to host this app, since SQLite needs a persistent filesystem and you don't need a separate database server.

#### Recommended VPS providers

| Provider | Cheapest plan | Notes |
|----------|---------------|-------|
| **Hetzner** | ~€4/mo (2 vCPU, 4 GB RAM) | Best price/performance. Good for a small school. |
| **DigitalOcean** | $6/mo (1 vCPU, 1 GB RAM) | Simple control panel, lots of tutorials, reliable — but Hetzner gives more for less. |
| **Linode (Akamai)** | $12/mo (1 vCPU, 1 GB RAM) | Solid alternative, decent docs. |
| **AWS Lightsail** | $3.50/mo (512 MB, 1 vCPU) | Cheapest entry, but limited RAM — only suitable for very light use. |

**Is DigitalOcean the best?** Not strictly — Hetzner gives you 4× the RAM for the same price. But DigitalOcean has the simplest UI, great tutorials, and is more than enough for a single-school TPT deployment. If you're comfortable with a slightly less polished dashboard, Hetzner is the better value. Any of them will work fine.

#### Step-by-step (Ubuntu 22.04+)

```bash
# 1. SSH into the VPS
ssh root@your-vps-ip

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install pm2
npm install -g pm2

# 4. Clone the repo
git clone https://github.com/PhillipC05/tpt-school.git
cd tpt-school

# 5. Set up environment
cp .env.example .env
nano .env
#   - AUTH_SECRET: generate one with `openssl rand -base64 32`
#   - NEXTAUTH_URL: set to your domain or IP, e.g. http://your-vps-ip:3000
#   - DATABASE_URL: leave as file:./dev.db (it'll live inside the project dir)

# 6. Install, migrate, build
npm ci
npx prisma migrate deploy
npm run build

# 7. Start
pm2 start .next/standalone/server.js --name tpt-school
pm2 save
pm2 startup

# 8. Set up a reverse proxy (optional but recommended)
#    Install Nginx to serve on port 80/443 with a domain name:
apt-get install -y nginx
#    Then configure /etc/nginx/sites-available/tpt-school to proxy
#    requests to localhost:3000 and add SSL via Certbot.
```

After those steps the app will be running on port `3000` and will restart automatically if the server reboots.

### Manual (any machine)

```bash
npm ci
cp .env.example .env         # edit AUTH_SECRET + NEXTAUTH_URL
npx prisma migrate deploy
npm run build
node .next/standalone/server.js
```

### Vercel (requires PostgreSQL/MySQL)

SQLite won't work on Vercel's serverless functions. Swap to a hosted database like [Neon](https://neon.tech) or [PlanetScale](https://planetscale.com) and update the Prisma schema.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [Prisma](https://prisma.io) (ORM with SQLite)
- [NextAuth](https://next-auth.js.org) (authentication)
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (UI)
- [React PDF](https://react-pdf.org) (report generation)
- [Playwright](https://playwright.dev) (E2E tests)

## License

[MIT](LICENSE)