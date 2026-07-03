-- ============================================================================
-- Production RPC Functions for Vector Search
-- Matches actual production schema (discovered 2025-11-18)
-- ============================================================================
-- Production Schema:
--   content_entries: id TEXT, title TEXT, content TEXT, embedding vector(1536)
--   content_chunks: id INTEGER (auto), entry_id TEXT, chunk_text TEXT,
--                   embedding vector(1536), chunk_index INTEGER, metadata JSONB
-- ============================================================================

-- Drop existing functions if they exist (allows re-running this migration)
DROP FUNCTION IF EXISTS match_content(vector(1536), double precision, integer);
DROP FUNCTION IF EXISTS search_content(vector(1536), text, double precision, integer, text, text[]);
DROP FUNCTION IF EXISTS search_chunks(vector(1536), double precision, integer);
DROP FUNCTION IF EXISTS find_similar_entries(text, integer);
DROP FUNCTION IF EXISTS check_vector_search_setup();

-- Match Content (used by demo-vector-search.ts and search-handler.ts)
-- Simple vector similarity search on entries
CREATE OR REPLACE FUNCTION match_content(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id text,
    title text,
    content text,
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
        1 - (e.embedding <=> query_embedding) as similarity
    FROM content_entries e
    WHERE
        e.embedding IS NOT NULL
        AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search Content (used by search-handler.ts and vector-search.ts)
-- Advanced search with filtering support
CREATE OR REPLACE FUNCTION search_content(
    query_embedding vector(1536),
    query_text text DEFAULT NULL,
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10,
    filter_category text DEFAULT NULL,
    filter_tags text[] DEFAULT NULL
)
RETURNS TABLE (
    id text,
    title text,
    content text,
    source_type text,
    source_location text,
    metadata jsonb,
    ingested_at timestamptz,
    updated_at timestamptz,
    category text,
    tags jsonb,
    confidence text,
    system_name text,
    rank float
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
        e.source_type,
        e.source_location,
        e.metadata,
        e.ingested_at,
        e.updated_at,
        (e.metadata->>'category') as category,
        (e.metadata->'tags') as tags,
        (e.metadata->>'confidence') as confidence,
        (e.metadata->>'system') as system_name,
        1 - (e.embedding <=> query_embedding) as rank
    FROM content_entries e
    WHERE
        e.embedding IS NOT NULL
        AND (filter_category IS NULL OR e.metadata->>'category' = filter_category)
        AND (filter_tags IS NULL OR e.metadata->'tags' ?| filter_tags)
        AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search Chunks (used by vector-search.ts)
-- Search within content chunks for granular results
-- NOTE: Uses chunk_text column (not text)
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20
)
RETURNS TABLE (
    id integer,
    entry_id text,
    chunk_text text,
    chunk_index integer,
    metadata jsonb,
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
        c.chunk_text,
        c.chunk_index,
        c.metadata,
        1 - (c.embedding <=> query_embedding) as similarity
    FROM content_chunks c
    WHERE
        c.embedding IS NOT NULL
        AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Find Similar Entries (used by vector-search.ts)
-- Find entries similar to a given entry
CREATE OR REPLACE FUNCTION find_similar_entries(
    target_id text,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id text,
    title text,
    category text,
    tags jsonb,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    target_embedding vector(1536);
BEGIN
    -- Get the embedding of the target entry
    SELECT embedding INTO target_embedding
    FROM content_entries
    WHERE content_entries.id = target_id;

    IF target_embedding IS NULL THEN
        RAISE EXCEPTION 'Entry % not found or has no embedding', target_id;
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.title,
        (e.metadata->>'category') as category,
        (e.metadata->'tags') as tags,
        1 - (e.embedding <=> target_embedding) as similarity
    FROM content_entries e
    WHERE
        e.id != target_id
        AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> target_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- UTILITY: Check RPC Functions
-- ============================================================================
CREATE OR REPLACE FUNCTION check_vector_search_setup()
RETURNS TABLE (
    function_name text,
    is_available boolean,
    description text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        'match_content'::text,
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'match_content'),
        'Simple vector similarity search'::text
    UNION ALL
    SELECT
        'search_content'::text,
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'search_content'),
        'Advanced search with filtering'::text
    UNION ALL
    SELECT
        'search_chunks'::text,
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'search_chunks'),
        'Granular chunk-level search'::text
    UNION ALL
    SELECT
        'find_similar_entries'::text,
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'find_similar_entries'),
        'Find similar entries'::text;
END;
$$;

-- ============================================================================
-- Grant permissions for anon key
-- ============================================================================
GRANT EXECUTE ON FUNCTION match_content TO anon;
GRANT EXECUTE ON FUNCTION search_content TO anon;
GRANT EXECUTE ON FUNCTION search_chunks TO anon;
GRANT EXECUTE ON FUNCTION find_similar_entries TO anon;
GRANT EXECUTE ON FUNCTION check_vector_search_setup TO anon;

-- ============================================================================
-- Verify setup
-- ============================================================================
-- Run this to check if all functions were created:
-- SELECT * FROM check_vector_search_setup();
