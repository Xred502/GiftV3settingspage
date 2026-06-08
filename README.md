# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## Local development

Backend is Node/Express, frontend is Vite/React.

Prerequisites:
- Node.js + npm
- VPN access to the SQL Server (for DB-backed flows)

Setup:

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm i

# Step 4: Create local env files
cp .env.example .env
cp .env.server.example .env.server.local
```

Then edit `.env.server.local` and set these values:

```ini
DB_HOST=192.168.3.4
DB_NAME=oncard
DB_USER=sa
DB_PASSWORD=<set-on-your-machine>
DB_TRUST_CERT=true
DB_ENCRYPT=true
```

Continue:

```sh
# Step 5: Start frontend + backend together
npm run dev:all
```

Useful endpoints:
- Frontend: http://localhost:8080
- Backend: http://localhost:3001
- Health: http://localhost:3001/api/health

Notes:
- Backend uses an httpOnly session cookie.
- SQL Server is accessed over VPN.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
