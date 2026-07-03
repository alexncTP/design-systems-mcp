-- ============================================================================
-- Design Systems MCP - PostgreSQL Schema with pgvector
-- ============================================================================
-- This schema provides optimized vector similarity search for design systems
-- knowledge using pgvector extension with HNSW indexes and hybrid search.
--
-- Requirements:
--   - PostgreSQL 12+ with pgvector extension
--   - OpenAI text-embedding-3-small (1536 dimensions)
--
-- Performance Optimizations:
--   - HNSW indexes for fast similarity search
--   - B-tree indexes for filtered queries
--   - Full-text search indexes for hybrid search
--   - Inline vector storage to avoid TOAST overhead
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text matching

-- ============================================================================
-- MAIN TABLES
-- ============================================================================

-- Content Entries Table
-- Stores full design systems articles, guides, and documentation
CREATE TABLE IF NOT EXISTS content_entries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small

    -- Source information
    source_type TEXT,  -- 'pdf', 'html', 'url', 'manual'
    source_location TEXT,
    source_url TEXT,

    -- Metadata (JSON for flexibility)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ingested_at TIMESTAMPTZ DEFAULT NOW(),

    -- Soft delete support
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Content Chunks Table
-- Stores smaller chunks of content for granular search
CREATE TABLE IF NOT EXISTS content_chunks (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,

    text TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small

    -- Chunk positioning
    chunk_index INTEGER NOT NULL,
    start_index INTEGER,
    end_index INTEGER,

    -- Metadata from chunking
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure logical ordering
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0)
);

-- ============================================================================
-- VECTOR STORAGE OPTIMIZATION
-- ============================================================================
-- Store vectors inline to avoid TOAST overhead and improve performance
ALTER TABLE content_entries ALTER COLUMN embedding SET STORAGE PLAIN;
ALTER TABLE content_chunks ALTER COLUMN embedding SET STORAGE PLAIN;

-- ============================================================================
-- INDEXES - Vector Similarity
-- ============================================================================
-- HNSW indexes for fast approximate nearest neighbor search
-- Using cosine distance (<=>) as recommended by OpenAI

-- Primary vector search on entries
CREATE INDEX IF NOT EXISTS idx_entries_embedding_hnsw
ON content_entries
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
-- m = 16: Good balance between build time and search performance
-- ef_construction = 64: Higher values = better index quality, longer build time

-- Primary vector search on chunks (more frequently used)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON content_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- INDEXES - Metadata & Filtering
-- ============================================================================
-- B-tree indexes for common filter queries

-- Category filtering (assumes metadata has 'category' field)
CREATE INDEX IF NOT EXISTS idx_entries_category
ON content_entries ((metadata->>'category'));

CREATE INDEX IF NOT EXISTS idx_entries_tags
ON content_entries USING gin ((metadata->'tags'));

-- Confidence level filtering
CREATE INDEX IF NOT EXISTS idx_entries_confidence
ON content_entries ((metadata->>'confidence'));

-- System/source filtering
CREATE INDEX IF NOT EXISTS idx_entries_system
ON content_entries ((metadata->>'system'));

-- Foreign key index for chunks
CREATE INDEX IF NOT EXISTS idx_chunks_entry_id
ON content_chunks (entry_id);

-- Chunk ordering index
CREATE INDEX IF NOT EXISTS idx_chunks_entry_chunk
ON content_chunks (entry_id, chunk_index);

-- Timestamp indexes for temporal queries
CREATE INDEX IF NOT EXISTS idx_entries_created_at
ON content_entries (created_at);

CREATE INDEX IF NOT EXISTS idx_entries_updated_at
ON content_entries (updated_at);

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_entries_not_deleted
ON content_entries (deleted_at)
WHERE deleted_at IS NULL;

-- ============================================================================
-- INDEXES - Full-Text Search (Hybrid Search Support)
-- ============================================================================
-- GIN indexes for full-text search capabilities

-- Title full-text search
CREATE INDEX IF NOT EXISTS idx_entries_title_fts
ON content_entries
USING gin(to_tsvector('english', title));

-- Content full-text search
CREATE INDEX IF NOT EXISTS idx_entries_content_fts
ON content_entries
USING gin(to_tsvector('english', content));

-- Chunk text full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_text_fts
ON content_chunks
USING gin(to_tsvector('english', text));

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_entries_title_trgm
ON content_entries
USING gin (title gin_trgm_ops);

-- ============================================================================
-- PARTIAL INDEXES - Optimized Filtered Searches
-- ============================================================================
-- These indexes optimize common filtered vector searches

-- High-confidence content
CREATE INDEX IF NOT EXISTS idx_entries_high_confidence_embedding
ON content_entries
USING hnsw (embedding vector_cosine_ops)
WHERE (metadata->>'confidence' = 'high');

-- Component category (likely most queried)
CREATE INDEX IF NOT EXISTS idx_entries_components_embedding
ON content_entries
USING hnsw (embedding vector_cosine_ops)
WHERE (metadata->>'category' = 'components');

-- Tokens category
CREATE INDEX IF NOT EXISTS idx_entries_tokens_embedding
ON content_entries
USING hnsw (embedding vector_cosine_ops)
WHERE (metadata->>'category' = 'tokens');

-- ============================================================================
-- SIMILARITY SEARCH FUNCTIONS
-- ============================================================================

-- Match Content Entries by Vector Similarity
-- Returns entries ordered by cosine similarity to query embedding
CREATE OR REPLACE FUNCTION match_content_entries(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_category text DEFAULT NULL,
    filter_system text DEFAULT NULL,
    filter_confidence text DEFAULT NULL
)
RETURNS TABLE (
    id text,
    title text,
    content text,
    source_url text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.content,
        e.source_url,
        e.metadata,
        1 - (e.embedding <=> query_embedding) as similarity
    FROM content_entries e
    WHERE
        e.deleted_at IS NULL
        AND e.embedding IS NOT NULL
        AND (filter_category IS NULL OR e.metadata->>'category' = filter_category)
        AND (filter_system IS NULL OR e.metadata->>'system' = filter_system)
        AND (filter_confidence IS NULL OR e.metadata->>'confidence' = filter_confidence)
        AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Match Content Chunks by Vector Similarity
-- Returns chunks ordered by cosine similarity to query embedding
CREATE OR REPLACE FUNCTION match_content_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20,
    min_chunk_length int DEFAULT 50
)
RETURNS TABLE (
    id text,
    entry_id text,
    text text,
    chunk_index int,
    entry_title text,
    entry_metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.entry_id,
        c.text,
        c.chunk_index,
        e.title as entry_title,
        e.metadata as entry_metadata,
        1 - (c.embedding <=> query_embedding) as similarity
    FROM content_chunks c
    INNER JOIN content_entries e ON c.entry_id = e.id
    WHERE
        e.deleted_at IS NULL
        AND c.embedding IS NOT NULL
        AND LENGTH(c.text) >= min_chunk_length
        AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Hybrid Search: Combine Vector + Full-Text Search
-- Uses both semantic similarity and keyword matching for best results
CREATE OR REPLACE FUNCTION hybrid_search_entries(
    query_text text,
    query_embedding vector(1536),
    vector_weight float DEFAULT 0.7,
    text_weight float DEFAULT 0.3,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id text,
    title text,
    content text,
    source_url text,
    metadata jsonb,
    combined_score float,
    vector_score float,
    text_score float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            e.id,
            1 - (e.embedding <=> query_embedding) as score
        FROM content_entries e
        WHERE e.deleted_at IS NULL AND e.embedding IS NOT NULL
    ),
    text_results AS (
        SELECT
            e.id,
            ts_rank(
                to_tsvector('english', e.title || ' ' || e.content),
                plainto_tsquery('english', query_text)
            ) as score
        FROM content_entries e
        WHERE e.deleted_at IS NULL
    )
    SELECT
        e.id,
        e.title,
        e.content,
        e.source_url,
        e.metadata,
        (COALESCE(v.score, 0) * vector_weight + COALESCE(t.score, 0) * text_weight) as combined_score,
        COALESCE(v.score, 0) as vector_score,
        COALESCE(t.score, 0) as text_score
    FROM content_entries e
    LEFT JOIN vector_results v ON e.id = v.id
    LEFT JOIN text_results t ON e.id = t.id
    WHERE
        e.deleted_at IS NULL
        AND (COALESCE(v.score, 0) * vector_weight + COALESCE(t.score, 0) * text_weight) >= match_threshold
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for content_entries
DROP TRIGGER IF EXISTS update_entries_updated_at ON content_entries;
CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON content_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Get embedding statistics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
    total_entries bigint,
    entries_with_embeddings bigint,
    total_chunks bigint,
    chunks_with_embeddings bigint,
    avg_chunks_per_entry numeric,
    oldest_entry timestamptz,
    newest_entry timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COUNT(*)::bigint as total_entries,
        COUNT(embedding)::bigint as entries_with_embeddings,
        (SELECT COUNT(*)::bigint FROM content_chunks) as total_chunks,
        (SELECT COUNT(embedding)::bigint FROM content_chunks) as chunks_with_embeddings,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND((SELECT COUNT(*)::numeric FROM content_chunks) / COUNT(*), 2)
            ELSE 0
        END as avg_chunks_per_entry,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry
    FROM content_entries
    WHERE deleted_at IS NULL;
$$;

-- ============================================================================
-- PERFORMANCE TUNING RECOMMENDATIONS
-- ============================================================================
-- Run these commands to optimize query performance:
--
-- 1. Set optimal HNSW search parameters (adjust based on recall needs):
--    SET hnsw.ef_search = 100;  -- Default is 40, increase for better recall
--
-- 2. For filtered queries, enable iterative scan:
--    SET hnsw.iterative_scan = relaxed_order;
--
-- 3. Monitor index usage:
--    SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
--
-- 4. Monitor slow queries:
--    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--    SELECT query, calls, mean_exec_time FROM pg_stat_statements
--    ORDER BY mean_exec_time DESC LIMIT 20;
--
-- 5. Reindex periodically for optimal performance:
--    REINDEX INDEX CONCURRENTLY idx_chunks_embedding_hnsw;
-- ============================================================================

-- Create a view for easy monitoring
CREATE OR REPLACE VIEW v_vector_search_health AS
SELECT
    'Embedding Coverage' as metric,
    ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as percentage,
    COUNT(embedding) as with_value,
    COUNT(*) - COUNT(embedding) as without_value
FROM content_entries
WHERE deleted_at IS NULL
UNION ALL
SELECT
    'Chunk Coverage' as metric,
    ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as percentage,
    COUNT(embedding) as with_value,
    COUNT(*) - COUNT(embedding) as without_value
FROM content_chunks;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON content_entries TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON content_chunks TO your_app_user;
-- GRANT EXECUTE ON FUNCTION match_content_entries TO your_app_user;
-- GRANT EXECUTE ON FUNCTION match_content_chunks TO your_app_user;
-- GRANT EXECUTE ON FUNCTION hybrid_search_entries TO your_app_user;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this schema in your Supabase SQL Editor or via psql
-- 2. Verify indexes: SELECT * FROM pg_indexes WHERE tablename IN ('content_entries', 'content_chunks');
-- 3. Test search functions with sample data
-- 4. Monitor performance with v_vector_search_health view
-- 5. Adjust hnsw.ef_search based on your recall requirements
-- ============================================================================
