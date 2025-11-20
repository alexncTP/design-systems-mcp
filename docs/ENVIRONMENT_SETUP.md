# Environment Configuration Guide

Quick reference for understanding and configuring environment files in this project.

## Environment Files Overview

This project uses **two sets** of environment files for different purposes:

### 1. `.env` Files (Node.js Scripts)

**Purpose:** Used by local Node.js scripts for development tools

**Used By:**
- Content ingestion: `npm run ingest:vectors`
- Database sync: `npm run sync:pull`, `npm run sync:push`
- Validation: `npm run validate:ingestion`
- Setup scripts: `npm run setup:supabase`

**Files:**
- `.env` - Your actual credentials (gitignored, never commit)
- `.env.example` - Template with placeholder values

**What Goes Here:**
- ✅ Local Supabase credentials (from `supabase start`)
- ✅ Production Supabase credentials (for database sync)
- ✅ OpenAI API key (for embeddings)
- ✅ Model preferences

### 2. `.dev.vars` Files (Cloudflare Workers)

**Purpose:** Used by Cloudflare Workers when running locally with `wrangler dev`

**Used By:**
- Local development server: `npm run dev`
- Cloudflare Workers: `wrangler dev`

**Files:**
- `.dev.vars` - Your actual credentials (gitignored, never commit)
- `.dev.vars.example` - Template with placeholder values

**What Goes Here:**
- ✅ OpenAI API key (for AI chat responses)
- ✅ Model preferences
- ❌ NO Supabase credentials (those go in `wrangler.toml` bindings)

## Quick Setup

### Step 1: Copy Example Files

```bash
# Copy the templates
cp .env.example .env
cp .dev.vars.example .dev.vars
```

### Step 2: Configure `.env` (Node.js Scripts)

Open `.env` and add your credentials:

```bash
# ============================================================================
# LOCAL SUPABASE (Development)
# ============================================================================
# Already configured by: supabase start
# These are auto-generated - leave as is

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGc...  # Already set
SUPABASE_SERVICE_KEY=eyJhbGc...  # Already set

# ============================================================================
# PRODUCTION SUPABASE (Cloud)
# ============================================================================
# ADD YOUR PRODUCTION CREDENTIALS:
# Get from: https://app.supabase.com/project/_/settings/api

SUPABASE_PROD_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_PROD_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# ============================================================================
# OPENAI API
# ============================================================================
# Already configured - or update with new key if needed

OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Step 3: Configure `.dev.vars` (Cloudflare Workers)

Open `.dev.vars` and add your OpenAI key:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Note:** You DON'T need Supabase credentials here - they're configured in `wrangler.toml` for Cloudflare Workers.

## Where to Get Credentials

### Local Supabase Credentials

**Already configured!** Generated automatically when you ran:
```bash
supabase start
```

These are in your `.env` file already.

### Production Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Copy these two values:
   - **Project URL** → `SUPABASE_PROD_URL`
   - **service_role secret** → `SUPABASE_PROD_SERVICE_KEY`

### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key → `OPENAI_API_KEY` (in both `.env` and `.dev.vars`)

## What Needs What?

| Task | Needs `.env` | Needs `.dev.vars` |
|------|--------------|-------------------|
| Ingest content | ✅ Yes | ❌ No |
| Sync databases | ✅ Yes | ❌ No |
| Validate data | ✅ Yes | ❌ No |
| Run local dev server (`wrangler dev`) | ❌ No | ✅ Yes |
| Deploy to Cloudflare | ❌ No | ❌ No (uses secrets) |

## Troubleshooting

### "Missing Supabase credentials" Error

**When running:** `npm run sync:compare` or `npm run sync:pull`

**Solution:** Add production credentials to `.env`:
```bash
SUPABASE_PROD_URL=https://xxxxx.supabase.co
SUPABASE_PROD_SERVICE_KEY=eyJhbGc...
```

### "Missing OpenAI API key" Error

**When running:** Any ingestion or embedding command

**Solution:** Check your `.env` file has:
```bash
OPENAI_API_KEY=sk-proj-your-actual-key
```

### "Invalid API key" Error

**Cause:** API key is expired, revoked, or incorrect

**Solution:**
1. Generate a new key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Update both `.env` and `.dev.vars` files
3. Restart any running processes

### Cloudflare Workers Can't Access Supabase

**When running:** `npm run dev`

**Solution:** Check `wrangler.toml` has Supabase bindings configured:
```toml
[[d1_databases]]
binding = "DB"
database_name = "your-database"
```

For production deployment, use Cloudflare secrets:
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

## Security Best Practices

### ✅ DO:
- Keep `.env` and `.dev.vars` files local only
- Add them to `.gitignore` (already done)
- Rotate API keys regularly
- Use service role keys only in secure environments
- Store production secrets in Cloudflare Workers secrets

### ❌ DON'T:
- Commit `.env` or `.dev.vars` to version control
- Share API keys in Slack, email, or documentation
- Use production credentials for local development
- Hardcode credentials in source files

## File Structure Reference

```
design-systems-mcp/
├── .env                    # Your actual Node.js env vars (gitignored)
├── .env.example            # Template for .env
├── .dev.vars               # Your actual Cloudflare env vars (gitignored)
├── .dev.vars.example       # Template for .dev.vars
└── wrangler.toml           # Cloudflare Workers config
```

## Next Steps

1. ✅ Configure production Supabase credentials in `.env`
2. ✅ Run database comparison: `npm run sync:compare`
3. ✅ Pull production data: `npm run sync:pull`
4. ✅ Validate data: `npm run validate:ingestion`
5. ✅ Start local development: `npm run dev`

For more detailed setup instructions:
- [Database Sync Guide](./DATABASE_SYNC.md)
- [Vector Search Setup](./VECTOR_SEARCH_SETUP.md)
