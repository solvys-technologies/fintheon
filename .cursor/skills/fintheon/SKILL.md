---
name: fintheon
description: FINTHEON is the world's first true AI-powered Integrated Trading Environment (ITE) under **Priced In Research.
---

# Overview

# FINTHEON — Project Rules

### MVP Features
- **PsychAssist**: Prevents tilting/overtrading via emotional resonance + duration-based execution monitoring
- **RiskFlow**: AI-powered news feed interpreting macro data with IV Scoring Matrix

### UI Inspiration
- macroscope.app + Cursor.com aesthetic

---

## Tech Stack

### Deployment (Priority Order)
| Priority | Platform | Use Case |
|----------|----------|----------|
| Primary | **Encore.dev** (Encore Cloud) | Backend services, APIs, DB, secrets, scheduled jobs |
| Secondary | **Cloudflare** (Workers/Pages) | Edge functions, static hosting, CDN, fallback |

### Frontend
- **TypeScript** (94%+ of codebase)
- **Next.js** + **Tailwind CSS**
- **Electron** for desktop app
- **Framer** for landing pages (limited deps: Framer Motion, Framer React only)

### Backend
- **Hono** (TypeScript, port 8080)
- **PostgreSQL** (optional — app works without DATABASE_URL via in-memory fallback)
- **OpenRouter** (Claude Opus 4.6 via Nous subscription)
- **Supabase** auth (optional — BYPASS_AUTH=true for local/Electron)
- ONLY required env var: `OPENROUTER_API_KEY`
- Do NOT ask users for DATABASE_URL, SUPABASE_URL, Neon credentials, or Clerk keys

### DevOps
- **GitHub Actions** for CI/CD
- **Cloudflare Workers** for edge compute
- Secrets via **Encore secrets** + env vars

---

## Required Patterns

### Encore API Endpoints
import { api, APIError } from "encore.dev/api";
export const myEndpoint = api(
{ method: "POST", path: "/api/resource", auth: true },
async (req: RequestType): Promise<ResponseType> => {
// Implementation
}
);

### Defensive Null Checks
​
if (!auth?.userID) {
console.error("Missing auth data");
return { conversations: [] };
}

### Circuit Breaker
​
let circuitBreakerTripped = false;
const fetchWithCircuitBreaker = async (url: string) => {
if (circuitBreakerTripped) {
return { error: "System offline", data: null };
}
try {
const response = await fetch(url);
if (response.status === 500) circuitBreakerTripped = true;
return { data: await response.json(), error: null };
} catch (e) {
return { error: e.message, data: null };
}
};

---

## API Documentation Sources
| Service | Docs | Key Areas |
|---------|------|-----------|
| Encore.dev | `encore.dev/docs` | Endpoints, SQLDatabase, Secrets, Auth |
| Clerk | `clerk.com/docs` | Auth, SDK methods, webhooks |
| AWS Bedrock | `docs.aws.amazon.com/bedrock` | Session mgmt, model invocation |
| LangChain | `js.langchain.com/docs` | Chains, agents, memory, tools |
| Cloudflare | `developers.cloudflare.com/workers` | Edge functions, KV, D1 |

---

## Codebase Summary

For a comprehensive overview of the codebase architecture, services, APIs, and implementation details, see:
**`.cursor/skills/fintheon/CODEBASE-SUMMARY.md`**

This summary includes:
- Complete API endpoint documentation
- Database schema and migrations
- Service architecture and module breakdown
- Integration points (TopstepX, AWS Bedrock, Clerk)
- Known issues and build-time considerations
- Development patterns and code examples

---

## Current Status

### ✅ Completed
- Encore.dev backend (Express migration done)
- AWS Bedrock Session Management
- Cloudflare architecture
- Database migrations + tagged template syntax
- Circuit breaker + error handling
- CORS + lazy initialization
- Clerk auth SDK
- Secrets management
- LangChain v0.3.x + VectorDB
- TypeScript frontend + Electron desktop
- CI/CD (GitHub Actions)

### 🚧 In Progress
- Autopilot Integration
- News Feed Launch & Debugging
- Agentic AI for IV Scoring
- Day-Bound Conversation Thread History
- App-Agentic Brain Layer
​
