# CI/CD Setup Guide

This document describes the Continuous Integration and Continuous Deployment setup for AutoAcct.

## 📋 Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- On Pull Request to `main` or `develop`
- On Push to `main` or `develop`

**Jobs:**

#### Backend Checks
| Step | Description |
|------|-------------|
| Setup Bun | Install Bun runtime |
| Cache Dependencies | Cache `~/.bun/install/cache` |
| Install | `bun install` |
| Lint | `bun run lint` (Biome) |
| Type Check | `bun run build --noEmit` |
| Test | `bun test` |

#### Frontend Checks
| Step | Description |
|------|-------------|
| Setup Node.js 20 | Install Node.js |
| Cache npm | Cache `node_modules` |
| Install | `npm ci` |
| Lint | `npm run lint` (ESLint) |
| Type Check | `npx tsc --noEmit` |
| Test | `npm run test -- --run` (Vitest) |
| Build | `npm run build` (Next.js) |

#### Security Audit
| Step | Description |
|------|-------------|
| Backend Audit | `bun audit` |
| Frontend Audit | `npm audit` |

### 2. CD Workflow (`.github/workflows/cd.yml`)

**Triggers:**
- On Push to `main`
- Manual trigger (`workflow_dispatch`)

**Jobs:**

#### Deploy Backend (Fly.io)
| Step | Description |
|------|-------------|
| Setup Flyctl | Install Fly.io CLI |
| Deploy | `flyctl deploy --remote-only` |

#### Deploy Frontend (Vercel)
| Step | Description |
|------|-------------|
| Setup Node.js | Install Node.js 20 |
| Install Vercel CLI | `npm install -g vercel` |
| Pull Environment | `vercel pull` |
| Build | `vercel build --prod` |
| Deploy | `vercel deploy --prebuilt --prod` |

#### Smoke Tests
| Step | Description |
|------|-------------|
| Wait | Sleep 30s for deployment |
| Health Check Backend | `curl $BACKEND_URL/health` |
| Health Check Frontend | `curl $FRONTEND_URL` |

## 🔐 Required Secrets

Add these secrets to your GitHub repository:

```
Settings → Secrets and variables → Actions → New repository secret
```

### Backend Deployment
| Secret | How to Get |
|--------|------------|
| `FLY_API_TOKEN` | Run `flyctl auth token` locally |

### Frontend Deployment
| Secret | How to Get |
|--------|------------|
| `VERCEL_TOKEN` | Run `vercel tokens create` |

### Health Checks
| Secret | Value |
|--------|-------|
| `BACKEND_URL` | Your Fly.io app URL |
| `FRONTEND_URL` | Your Vercel app URL |

## 🚀 Quick Start

### Option 1: Run Setup Script
```bash
./setup-cicd.sh
```

### Option 2: Manual Setup

1. **Add Secrets to GitHub:**
   ```bash
   # Get Fly.io token
   flyctl auth token
   
   # Get Vercel token
   vercel tokens create
   ```

2. **Go to GitHub Settings:**
   ```
   https://github.com/YOUR_USERNAME/AutoAcct/settings/secrets/actions
   ```

3. **Add all required secrets**

4. **Create a PR to test:**
   ```bash
   git checkout -b feature/test-cicd
   git add .
   git commit -m "Add CI/CD workflows"
   git push origin feature/test-cicd
   ```

5. **Create Pull Request on GitHub**
   - CI will run automatically
   - Check the Actions tab for results

6. **Merge to deploy:**
   - Merge PR to `main`
   - CD will deploy automatically

## 📊 Status Badges

Add these to your README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/AutoAcct/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/YOUR_USERNAME/AutoAcct/actions/workflows/cd.yml/badge.svg)
```

## 🛠️ Troubleshooting

### Backend Tests Fail
```bash
cd backend
bun test
```

### Frontend Tests Fail
```bash
cd frontend
npm run test
```

### Fly.io Deploy Fails
```bash
cd backend
flyctl deploy
```

### Vercel Deploy Fails
```bash
cd frontend
vercel --prod
```

## 📝 Notes

- CI uses `continue-on-error: true` for initial setup
- Remove `continue-on-error` after stabilizing
- Backend uses **Bun** for faster builds
- Frontend uses **Node.js 20** for compatibility
