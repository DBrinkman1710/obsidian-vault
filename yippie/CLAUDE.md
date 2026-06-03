# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **apps/app**: Next.js 14, NextAuth v4 (JWT/credentials), Prisma + PostgreSQL, Tailwind CSS
- **apps/web**: Next.js 14 marketing site (minimal, mostly placeholder)
- **Package manager**: pnpm 9.15.4 — always use `pnpm`, never `npm` inside this repo

## Local setup

```bash
# Prerequisites: Node 20+, pnpm, PostgreSQL 16
# (or: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16)

cd yippie
pnpm install

cp apps/app/.env.example apps/app/.env
# Fill in apps/app/.env:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yippie
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3001
#   NEXT_PUBLIC_APP_URL=http://localhost:3001
#   NEXT_PUBLIC_WEB_URL=http://localhost:3000
#   APP_ENV=development

createdb yippie
pnpm --filter @yippie/app db:migrate

SUPER_ADMIN_EMAIL=you@email.com SUPER_ADMIN_PASSWORD=yourpassword \
  pnpm --filter @yippie/app db:seed

pnpm dev:app    # http://localhost:3001
```

## Commands

```bash
pnpm dev:app                                          # run app only (port 3001)
pnpm dev:web                                          # run marketing site (port 3000)
pnpm dev                                              # run both
pnpm build                                            # build all
pnpm --filter @yippie/app type-check                  # TypeScript check
pnpm --filter @yippie/app lint                        # ESLint

pnpm --filter @yippie/app db:migrate                  # prisma migrate dev
pnpm --filter @yippie/app db:seed                     # seed super-admin (needs env vars)
```

## Architecture — apps/app

### Auth & multi-tenancy
- NextAuth credentials provider (email + bcrypt), JWT strategy
- Every user belongs to a `Company` via `companyId`; the JWT carries `id`, `role`, `companyId`, `companyName`
- Roles: `SUPER_ADMIN`, `ADMIN`, `MEMBER`
- Middleware (`src/middleware.ts`) protects `/dashboard/*` and `/admin/*`; redirects non-SUPER_ADMIN away from `/admin`

### Key files

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config — credentials, JWT/session callbacks |
| `src/lib/db.ts` | Prisma client singleton |
| `src/middleware.ts` | Route protection |
| `src/types/next-auth.d.ts` | Session/JWT type extensions (id, role, companyId, companyName) |
| `prisma/schema.prisma` | `Company` and `User` models |
| `src/app/dashboard/layout.tsx` | Shell: server session check + `<Sidebar>` |
| `src/components/sidebar.tsx` | Nav — admin items gated to ADMIN/SUPER_ADMIN |
| `src/app/admin/` | SUPER_ADMIN panel: list/create companies, view users |
| `src/app/dashboard/settings/` | Account settings: profile, password, team management |
| `src/app/api/account/` | PATCH profile name, PATCH password |
| `src/app/api/team/` | GET/POST members, PATCH role, DELETE member (admin only, company-scoped) |

### Dashboard module pages
All modules under `src/app/dashboard/` (inbox, contacts, tickets, chat, activity, billing) are currently Coming Soon stubs. Settings is fully implemented.

### Prisma migrations
```bash
# After changing schema.prisma:
pnpm --filter @yippie/app db:migrate    # creates and applies migration
```
