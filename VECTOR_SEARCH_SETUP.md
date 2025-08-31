# Vector Search Setup Guide

This guide will help you set up Supabase vector search for the Design Systems MCP, replacing the manual weighted search with semantic search capabilities.

## 🚀 Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (free tier is sufficient for 104 entries)
3. Note your project URL and anon key from Settings → API

### 2. Enable pgvector Extension

In your Supabase dashboard:
1. Go to SQL Editor
2. Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### 3. Create Database Schema

Run the schema file in SQL Editor:
```bash
# Copy contents of database/schema.sql and run in Supabase SQL Editor
```

Or use the Supabase CLI:
```bash
supabase db push --db-url "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres" < database/schema.sql
```

### 4. Configure Environment

Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Supabase Configuration
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=eyJ...[your-anon-key]
SUPABASE_SERVICE_KEY=eyJ...[optional-service-key-for-admin-operations]

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=sk-...[your-openai-key]

# Vector Search Configuration
VECTOR_SEARCH_ENABLED=true
VECTOR_SEARCH_MODE=hybrid
VECTOR_SEARCH_THRESHOLD=0.7
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Ingest Content

Generate embeddings and upload to Supabase:
```bash
# Dry run to check cost estimate
npm run ingest:vectors -- --dry-run --verbose

# Actual ingestion
npm run ingest:vectors -- --clear --verbose
```

Expected output:
```
🚀 Starting vector ingestion pipeline...
📚 Loading content entries...
📄 Found 104 entries to process

📦 Processing batch 1/11
✅ Processed: Design System Glossary (3 chunks, $0.0012)
...

📊 Ingestion Summary:
✅ Successful: 104/104
💰 Estimated cost: $3.45
⏱️  Duration: 45.23 seconds
```

### 7. Test Vector Search

```bash
npm run test:vector
```

## 📊 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VECTOR_SEARCH_ENABLED` | Enable vector search | `true` |
| `VECTOR_SEARCH_MODE` | Search mode: `vector`, `text`, `hybrid` | `hybrid` |
| `VECTOR_SEARCH_THRESHOLD` | Minimum similarity score (0-1) | `0.7` |
| `VECTOR_SEARCH_CHUNK_SIZE` | Text chunk size for granular search | `1000` |
| `EMBEDDING_MODEL` | OpenAI model for embeddings | `text-embedding-3-small` |
| `EMBEDDING_BATCH_SIZE` | Parallel processing batch size | `10` |
| `USE_VECTOR_FALLBACK` | Fallback to keyword search if vector fails | `true` |
| `LOG_SEARCH_PERFORMANCE` | Log search timing metrics | `true` |

### Search Modes

- **`vector`**: Pure semantic search using embeddings
- **`text`**: Traditional full-text search (PostgreSQL)
- **`hybrid`**: Combines vector (70%) + text (30%) scores

## 💰 Cost Analysis

### One-Time Ingestion
- 104 entries × ~500 tokens average = 52,000 tokens
- Chunks (if content > 1000 chars) = ~200 additional embeddings
- Total: ~250 embeddings
- **Cost: $3-5** (text-embedding-3-small: $0.00002/1K tokens)

### Ongoing Usage
- Query embeddings: ~$0.01 per 1000 searches
- Supabase free tier: 500MB storage, 2GB transfer/month
- **Estimated monthly: <$10** for typical usage

## 🔄 Migration Strategy

### Phase 1: Parallel Testing (Current)
Both systems run side-by-side:
```javascript
// Automatic in content-manager-vector.ts
if (vectorSearchAvailable) {
  // Use vector search
} else {
  // Fallback to keyword search
}
```

### Phase 2: Monitor Performance
Check metrics:
```bash
# In your app logs
🎯 Vector search: 15 results in 245ms
🔍 Fallback search: 8 results in 412ms
```

### Phase 3: Full Migration
Once confident, disable fallback:
```env
USE_VECTOR_FALLBACK=false
```

## 🧪 Testing

### Test Vector Search Quality
```bash
npm run compare:search
```

This runs common queries through both systems and compares:
- Result relevance
- Response time
- Result overlap

### Test Individual Queries
```javascript
// test-vector-search.ts
const results = await searchEntriesVector({
  query: "what are slots?",
  mode: 'hybrid',
  limit: 10
});
```

## 🚨 Troubleshooting

### "Vector search not available"
- Check Supabase credentials in `.env`
- Verify pgvector extension is enabled
- Ensure tables are created (check Supabase Table Editor)

### "Missing embeddings"
- Run ingestion: `npm run ingest:vectors -- --verbose`
- Check for failed entries in output
- Verify OpenAI API key is valid

### "Slow search performance"
- Check indexes are created (see schema.sql)
- Adjust `VECTOR_SEARCH_THRESHOLD` (lower = more results but slower)
- Consider using `vector` mode instead of `hybrid`

### "No results found"
- Lower threshold: `VECTOR_SEARCH_THRESHOLD=0.5`
- Try different search mode: `VECTOR_SEARCH_MODE=text`
- Check content is ingested: Query Supabase directly

## 📈 Performance Benchmarks

Expected performance with 104 entries:

| Operation | Time | Notes |
|-----------|------|-------|
| Query embedding generation | 50-100ms | OpenAI API call |
| Vector similarity search | 10-30ms | HNSW index |
| Hybrid search | 50-150ms | Vector + text |
| Total end-to-end | 100-250ms | Including network |

## 🔒 Security Notes

- Use `SUPABASE_ANON_KEY` for client-side operations
- Use `SUPABASE_SERVICE_KEY` only for admin tasks (ingestion)
- Never expose service key in client code
- Enable RLS (Row Level Security) for production

## 🆘 Support

- **Supabase Issues**: Check [Supabase Discord](https://discord.supabase.com)
- **OpenAI Issues**: Verify API key at [platform.openai.com](https://platform.openai.com)
- **This Project**: Open issue on GitHub