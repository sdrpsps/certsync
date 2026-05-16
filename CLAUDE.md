# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **refactoring project** that reimplements [certsync](https://github.com/sdrpsps/certsync) using Next.js 16.x + Hono.js architecture. The original certsync is a Docker-based centralized SSL/TLS certificate management system that automates certificate provisioning and deployment across multiple targets (Synology NAS, SSH servers).

**Core Functionality to Preserve:**
- Centralized certificate management via single JSON configuration
- Multi-target deployment (Synology DSM via WebAPI, SSH-based servers)
- Automatic renewal with daemon mode (daily checks)
- Wildcard certificate support (domain + *.domain)
- Development/staging modes to avoid Let's Encrypt rate limits
- ACME protocol integration (originally via acme.sh)

**Refactoring Goal:** Transform shell script + Docker architecture into a modern web application with:
- Next.js 16.x frontend for configuration UI and monitoring
- Hono.js backend API for certificate operations
- Maintain all original functionality while improving UX and maintainability

## Technology Stack

- **Frontend:** Next.js 16.2.6 (App Router), React 19.2.4, Tailwind CSS 4
- **UI Components:** shadcn/ui (required for all UI components)
- **Backend:** Hono.js
- **Package Manager:** pnpm
- **Language:** TypeScript 5

## Development Commands

```bash
# Start development server (default: http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Next.js 16.x Breaking Changes

**CRITICAL:** This project uses Next.js 16.x which has breaking changes from previous versions. Before writing any Next.js code:

1. Read the relevant guide in `node_modules/next/dist/docs/`
2. Check for deprecation notices in the documentation
3. Do NOT rely on training data for Next.js APIs - verify current syntax

Key areas with potential breaking changes:
- App Router conventions
- Server Components vs Client Components
- Route handlers and API routes
- Middleware patterns
- Configuration options in `next.config.ts`

## UI Components

**REQUIRED:** All UI components must use [shadcn/ui](https://ui.shadcn.com/).

- Install components as needed using the shadcn CLI: `pnpm dlx shadcn@latest add <component>`
- Components are installed to `components/ui/` directory
- Customize components by editing the generated files directly
- Follow shadcn/ui conventions for styling and composition
- Do NOT use other UI libraries (Material-UI, Ant Design, etc.)

**Common components to use:**
- Forms: `form`, `input`, `button`, `select`, `checkbox`, `radio-group`
- Layout: `card`, `separator`, `tabs`, `dialog`, `sheet`
- Feedback: `alert`, `toast`, `badge`, `progress`
- Data: `table`, `dropdown-menu`, `popover`

## Architecture

```
cert-sync/
├── app/                    # Next.js App Router
│   ├── server/            # Hono.js backend
│   │   ├── routes/        # API routes
│   │   ├── services/      # Certificate operations
│   │   └── index.ts       # Hono app entry
│   ├── (dashboard)/       # Dashboard UI for cert management
│   ├── api/               # Next.js API route handlers
│   │   └── [[...route]]/  # Catch-all route for Hono
│   └── layout.tsx         # Root layout
├── components/
│   └── ui/                # shadcn/ui components
├── lib/                   # Shared utilities
│   ├── acme/              # ACME protocol client
│   ├── deployers/         # Synology, SSH deployers
│   └── config/            # Configuration parser
└── config/                # Certificate configuration files
```

## Implementation Priorities

1. **Configuration Schema:** Define TypeScript types for certificate config (domains, targets, credentials)
2. **ACME Client:** Implement or integrate ACME protocol client for Let's Encrypt
3. **Deployment Modules:**
   - Synology DSM WebAPI client
   - SSH-based deployment (scp + remote reload)
4. **Hono.js API:** RESTful endpoints for cert operations (issue, renew, deploy, status)
5. **Next.js UI:** Dashboard for configuration, monitoring, and manual operations
6. **Scheduler:** Cron-like daemon for automatic renewal checks

## Security Considerations

- Store credentials securely (environment variables, encrypted config)
- Validate all user inputs in configuration
- Implement proper authentication for web UI
- Use secure communication for certificate deployment (SSH keys, HTTPS)
- Never commit private keys or API tokens

## Original certsync Workflow Reference

1. Configuration validation (JSON parsing)
2. Environment setup (acme.sh initialization)
3. Certificate issuance per domain (with wildcard)
4. Parallel deployment to all configured targets
5. Daemon mode for continuous renewal monitoring

This workflow should be preserved in the refactored architecture with improved error handling and user feedback.
