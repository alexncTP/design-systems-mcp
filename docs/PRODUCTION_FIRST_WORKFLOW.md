# Production-First Workflow (Recommended)

Simple, fast workflow using production database directly - no Docker or local Supabase required.

## ✅ Why Production-First?

**Simpler:**
- No Docker Desktop required
- No local Supabase containers
- Fewer environment variables to manage
- One source of truth for all data

**Faster:**
- Ingest directly to production
- Test locally against real production data
- No sync steps needed
- Immediate availability to users

**Safer:**
- Production database has proven schema
- 100% embedding coverage already
- Validation catches issues before they go live
- Easy rollback if needed

## 🚀 Quick Setup

### Step 1: Get Production Credentials

You need **two keys** from Supabase dashboard:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Copy these values:

```bash
# Project URL (already have this)
SUPABASE_URL=https://xxxxx.supabase.co

# Project API keys (need the anon/public key)
SUPABASE_ANON_KEY=eyJhbGc...  # ← Copy the 'anon public' key
SUPABASE_PROD_SERVICE_KEY=eyJhbGc...  # ← Already have this
```

### Step 2: Configure `.env`

Your `.env` should have (I've already set this up):

```bash
# For MCP server local testing (npm run dev)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here  # ← ADD THIS

# For ingestion and sync tools
SUPABASE_PROD_URL=https://your-project.supabase.co  # ✅ Already set
SUPABASE_PROD_SERVICE_KEY=your-service-key  # ✅ Already set

# OpenAI for embeddings
OPENAI_API_KEY=sk-proj-your-key  # ✅ Already set

# Enable vector search
VECTOR_SEARCH_ENABLED=true  # ✅ Already set
VECTOR_SEARCH_MODE=vector  # ✅ Already set
```

### Step 3: Enable Vector Search in Ingestion

The ingestion script needs to target production. I'll configure this for you.

## 📝 Standard Workflow

### Adding New Content

```bash
# 1. Add content files to content/entries/
# (You already have 107 files ready!)

# 2. Ingest directly to production
npm run ingest:vectors

# 3. Validate data integrity
npm run validate:ingestion

# 4. Test locally with production data
npm run dev
# Test MCP queries to verify searchability

# Done! Content is immediately available to users.
```

### Testing Before Deployment

```bash
# Start local dev server (uses production data)
npm run dev

# Test queries:
# - Search for "button component"
# - Search for "design tokens"
# - Verify new content appears in results
```

### Validating Production Health

```bash
# Check production database stats
npm run test:prod

# Validate data integrity
npm run validate:ingestion
```

## 🔧 Configuration Files

### `.env` (Node.js Scripts & Local Dev)
Used by:
- Ingestion: `npm run ingest:vectors`
- Validation: `npm run validate:ingestion`
- Local MCP server: `npm run dev`

### `.dev.vars` (Cloudflare Workers)
Used by:
- `wrangler dev` (alternative to npm run dev)
Only needs OpenAI key - Supabase configured separately

## 🆚 vs. Local Development Workflow

| Feature | Production-First | Local Development |
|---------|------------------|-------------------|
| Setup Time | 5 minutes | 30+ minutes |
| Docker Required | ❌ No | ✅ Yes |
| Disk Space | Minimal | ~2GB for Docker |
| Data Sync | Not needed | Constant syncing |
| Testing | Against real data | Against copy |
| Deployment | Instant | Multi-step |

## ❓ Common Questions

**Q: What if I make a mistake?**
A: Validation runs before ingestion. If issues detected, nothing is written.

**Q: Can I test locally before production?**
A: Yes! `npm run dev` connects to production database for testing.

**Q: What about other team members?**
A: Everyone uses same production database. No sync conflicts.

**Q: How do I roll back bad data?**
A: Delete bad entries via Supabase dashboard or SQL query.

**Q: What about rate limits?**
A: Ingestion is batched with delays to respect OpenAI limits.

**Q: Do I need local Supabase at all?**
A: No! Everything works with production only.

## 🧹 Optional: Remove Local Supabase

If you want to simplify further:

```bash
# Stop local Supabase (if running)
supabase stop

# Remove local Supabase project files (optional)
rm -rf supabase/

# Remove Docker containers (optional)
docker system prune
```

**Keep these for reference:**
- Documentation in `docs/` (useful for understanding)
- Sync scripts (useful if you ever need them)
- `.env` variables (even local ones won't hurt)

## 📚 Related Documentation

- [Environment Setup](./ENVIRONMENT_SETUP.md) - Complete environment guide
- [Database Sync](./DATABASE_SYNC.md) - Advanced: If you ever need local development
- [Vector Search Setup](./VECTOR_SEARCH_SETUP.md) - Technical details

## 🎯 Next Steps

1. ✅ Add `SUPABASE_ANON_KEY` to `.env` (get from dashboard)
2. ✅ Ingest your 107 content files: `npm run ingest:vectors`
3. ✅ Validate: `npm run validate:ingestion`
4. ✅ Test locally: `npm run dev`
5. ✅ Deploy to Cloudflare (content already in production!)
