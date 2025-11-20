# Production Database Schema

**Last Updated:** 2025-11-18
**Database:** https://icpqiryocqhdbhdfwaqm.supabase.co

## Investigation Summary

The production schema differs significantly from the migration file expectations. This document captures the **actual production schema** discovered through systematic testing.

---

## content_entries

### Actual Production Schema
| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | text | NOT NULL | Primary key |
| title | text | NOT NULL | |
| content | text | NOT NULL | |
| embedding | vector(1536) | YES | |
| source_type | text | YES | |
| source_location | text | YES | |
| metadata | jsonb | YES | |
| ingested_at | timestamptz | YES | |
| updated_at | timestamptz | YES | Auto-updated |
| **category** | text | YES | **EXTRA** - not in migration |
| **confidence** | text | YES | **EXTRA** - not in migration |
| **search_text** | text | YES | **EXTRA** - tsvector for full-text search |
| **system_name** | text | YES | **EXTRA** - not in migration |
| **tags** | text[] | YES | **EXTRA** - array column, not in migration |

### Migration Expected (Differences)
- ❌ **MISSING**: `created_at` - not in production
- ❌ **MISSING**: `deleted_at` - not in production
- ❌ **MISSING**: `source_url` - not in production (stored in metadata.source_url)
- ✅ **EXTRA**: `category, confidence, search_text, system_name, tags` - flattened from metadata for query optimization

### Notes
- Production has **flattened metadata** structure for better query performance
- `search_text` appears to be generated tsvector for full-text search
- Metadata JSONB still contains: `tags, category, confidence, source_url, last_updated`

---

## content_chunks

### Actual Production Schema (Discovered 2025-11-18)
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| **id** | **integer** | NOT NULL | auto-increment | **PRIMARY KEY** (INTEGER not TEXT!) |
| entry_id | text | NOT NULL | | Foreign key to content_entries.id |
| **chunk_text** | text | NOT NULL | | **Column name is 'chunk_text' not 'text'** |
| chunk_index | integer | NOT NULL | | |
| embedding | vector(1536) | YES | | |
| metadata | jsonb | YES | {} | |
| created_at | timestamptz | YES | now() | Auto-timestamp |

### Migration Expected (Differences)
- ❌ **WRONG TYPE**: `id` is **INTEGER** (auto-increment) not TEXT
- ❌ **WRONG NAME**: Column is `chunk_text` not `text`
- ❌ **MISSING**: `start_index` - not in production (stored in metadata)
- ❌ **MISSING**: `end_index` - not in production (stored in metadata)

### Critical Differences
1. **ID Field**: Production uses auto-incrementing INTEGER, migration expects TEXT with manual IDs
2. **Text Column**: Production uses `chunk_text`, migration expects `text`
3. **Position Tracking**: start_index/end_index moved to metadata JSONB

---

## Schema Discovery Process

### Method
Used systematic insert testing with error message analysis:
1. Attempted various column combinations
2. Analyzed error messages to identify:
   - Non-existent columns
   - Wrong column types
   - NOT NULL constraints
3. Successful insert revealed actual schema

### Discovery Scripts
- `scripts/discover-chunks-schema.ts` - Initial exploration
- `scripts/discover-chunks-schema-v2.ts` - Refined testing
- `scripts/inspect-production-schema.ts` - Data-based inspection

### Key Insight
The error "invalid input syntax for type integer: 'test-chunk-003'" revealed that `id` is INTEGER, which led to discovering the complete schema mismatch.

---

## Code Alignment Status

### ✅ Fixed in Code
- `src/lib/vector-ingestion.ts`:
  - `uploadEntry()`: Removed `source_url` column reference
  - `uploadChunks()`: Changed to use `chunk_text`, INTEGER id (auto), moved start_index/end_index to metadata

### ⏳ Not Yet Updated
- `supabase/migrations/20250118000000_initial_vector_schema.sql` - Migration file doesn't match production
- Decision needed: Update migration to match production, or migrate production to match migration?

---

## Ingestion Results

### Before Fix
- ✅ 48/104 entries succeeded (single-chunk entries)
- ❌ 56/104 entries failed (multi-chunk entries due to schema mismatch)

### After Fix
- ⏳ Pending full re-ingestion with corrected schema

---

## Recommendations

1. **Clear Strategy**: Decide whether to:
   - **Option A**: Keep production schema, update migration file to document actual structure
   - **Option B**: Migrate production to match migration expectations
   - **Recommendation**: Keep production (flattened structure has query performance benefits)

2. **Re-ingestion**: Clear existing 104 entries and re-ingest all 104 cleaned files

3. **Documentation**: Keep this file updated with any schema changes

4. **Testing**: Verify vector search quality with cleaned content
