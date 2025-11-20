/**
 * Vector Search Implementation for Supabase
 * Provides semantic search capabilities using embeddings
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ContentEntry, ContentChunk } from '../../types/content';

// Types
// Database row types for Supabase queries
interface ContentEntryRow {
  id: string;
  title: string;
  content: string;
  embedding?: number[];
  source_type?: string;
  source_location?: string;
  source_url?: string;
  metadata: any;
  created_at?: string;
  updated_at?: string;
  ingested_at?: string;
}

interface ContentChunkRow {
  id: string;
  entry_id: string;
  text: string;
  chunk_text?: string;  // Alias for text
  embedding?: number[];
  chunk_index: number;
  start_index?: number;
  end_index?: number;
  metadata?: any;
  similarity?: number;
}

export interface VectorSearchOptions {
  query: string;
  mode?: 'vector' | 'text' | 'hybrid';
  category?: string;
  tags?: string[];
  confidence?: string;
  limit?: number;
  threshold?: number;
}

export interface VectorSearchResult {
  entry: ContentEntry;
  score: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface ChunkSearchResult {
  entry: ContentEntry;
  chunk: ContentChunk;
  score: number;
}

// Cache for embeddings to reduce API calls
const embeddingCache = new Map<string, number[]>();

// Initialize clients
function initializeClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Vector search disabled: Missing Supabase credentials');
    return null;
  }

  if (!openaiKey) {
    console.warn('Vector search disabled: Missing OpenAI API key');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });
    return { supabase, openai };
  } catch (error) {
    console.error('Failed to initialize vector search clients:', error);
    return null;
  }
}

/**
 * Generate embedding for query with caching
 */
async function generateQueryEmbedding(
  openai: OpenAI,
  query: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  // Check cache first
  const cacheKey = `${model}:${query}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  try {
    const response = await openai.embeddings.create({
      model,
      input: query.slice(0, 8191),
    });

    const embedding = response.data[0].embedding;
    
    // Cache for 15 minutes
    embeddingCache.set(cacheKey, embedding);
    setTimeout(() => embeddingCache.delete(cacheKey), 15 * 60 * 1000);
    
    return embedding;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    throw error;
  }
}

/**
 * Perform vector search on content entries
 */
export async function searchEntriesVector(
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const clients = initializeClients();
  if (!clients) {
    console.warn('Vector search not available, falling back to keyword search');
    return [];
  }

  const { supabase, openai } = clients;
  const {
    query,
    mode = 'hybrid',
    category,
    tags,
    confidence,
    limit = 10,
    threshold = 0.4,
  } = options;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateQueryEmbedding(openai, query);

    // Call Supabase function for hybrid search
    const { data, error } = await supabase.rpc('search_content', {
      query_embedding: queryEmbedding,
      query_text: mode !== 'vector' ? query : null,
      match_threshold: threshold,
      match_count: limit,
      filter_category: category,
      filter_tags: tags,
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    // Transform results to ContentEntry format
    const results: VectorSearchResult[] = (data || []).map((row: any) => {
      // Determine relevance based on score
      let relevance: 'high' | 'medium' | 'low' = 'low';
      if (row.rank >= 0.85) relevance = 'high';
      else if (row.rank >= 0.75) relevance = 'medium';

      return {
        entry: {
          id: row.id,
          title: row.title,
          content: row.content,
          source: {
            type: 'database',
            location: 'supabase',
            ingested_at: new Date().toISOString(),
          },
          chunks: [],
          metadata: {
            category: row.category,
            tags: row.tags || [],
            confidence: row.confidence || confidence,
            last_updated: new Date().toISOString(),
            source_url: '',
          },
        },
        score: row.rank,
        relevance,
      };
    });

    // Filter by confidence if specified
    if (confidence) {
      return results.filter(r => r.entry.metadata.confidence === confidence);
    }

    return results;
  } catch (error) {
    console.error('Vector search failed:', error);
    return [];
  }
}

/**
 * Search within content chunks for granular results
 */
export async function searchChunksVector(
  query: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<ChunkSearchResult[]> {
  const clients = initializeClients();
  if (!clients) {
    console.warn('Vector search not available');
    return [];
  }

  const { supabase, openai } = clients;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateQueryEmbedding(openai, query);

    // Call Supabase function for chunk search
    const { data: chunks, error: chunkError } = await supabase.rpc('search_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (chunkError) {
      console.error('Chunk search error:', chunkError);
      return [];
    }

    // Get full entries for the chunks
    const entryIds = [...new Set((chunks || []).map((c: any) => c.entry_id))];
    
    const { data: entries, error: entryError } = await supabase
      .from('content_entries')
      .select('*')
      .in('id', entryIds);

    if (entryError) {
      console.error('Error fetching entries:', entryError);
      return [];
    }

    // Map chunks to results
    const entryMap = new Map((entries || []).map((e: ContentEntryRow) => [e.id, e]));
    
    return (chunks || []).map((chunk: any) => {
      const entry = entryMap.get(chunk.entry_id);
      if (!entry) return null;

      return {
        entry: {
          id: entry.id,
          title: entry.title,
          content: entry.content,
          source: {
            type: 'database',
            location: 'supabase',
            ingested_at: entry.ingested_at,
          },
          chunks: [],
          metadata: entry.metadata || {},
        },
        chunk: {
          id: `chunk-${chunk.chunk_index}`,
          text: chunk.chunk_text,
          metadata: {
            startIndex: 0,
            endIndex: chunk.chunk_text.length,
            chunkIndex: chunk.chunk_index,
            section: 'Content',
            globalChunkIndex: chunk.chunk_index,
          },
        },
        score: chunk.similarity,
      };
    }).filter(Boolean) as ChunkSearchResult[];
  } catch (error) {
    console.error('Chunk search failed:', error);
    return [];
  }
}

/**
 * Find similar entries based on an existing entry
 */
export async function findSimilarEntries(
  entryId: string,
  limit: number = 5
): Promise<VectorSearchResult[]> {
  const clients = initializeClients();
  if (!clients) {
    return [];
  }

  const { supabase } = clients;

  try {
    const { data, error } = await supabase.rpc('find_similar_entries', {
      target_id: entryId,
      match_count: limit,
    });

    if (error) {
      console.error('Similar entries search error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      entry: {
        id: row.id,
        title: row.title,
        content: '',
        source: {
          type: 'database',
          location: 'supabase',
          ingested_at: new Date().toISOString(),
        },
        chunks: [],
        metadata: {
          category: row.category,
          tags: [],
          confidence: 'medium',
          last_updated: new Date().toISOString(),
          source_url: '',
        },
      },
      score: row.similarity,
      relevance: row.similarity >= 0.85 ? 'high' : row.similarity >= 0.75 ? 'medium' : 'low',
    }));
  } catch (error) {
    console.error('Similar entries search failed:', error);
    return [];
  }
}

/**
 * Vector Search Class
 */
export class VectorSearch {
  private supabase: any;
  private openai: any;
  
  constructor(supabase: any) {
    this.supabase = supabase;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const OpenAI = require('openai');
      this.openai = new OpenAI.default({ apiKey: openaiKey });
    }
  }
  
  async search(query: string, options: any = {}) {
    const { mode = 'hybrid', limit = 10 } = options;
    const results = await searchEntriesVector({
      query,
      mode,
      limit,
      threshold: 0.4
    });
    return results.map(r => ({
      ...r.entry,
      similarity: r.score
    }));
  }
}

/**
 * Check if vector search is available
 */
export async function isVectorSearchAvailable(): Promise<boolean> {
  const clients = initializeClients();
  if (!clients) return false;

  const { supabase } = clients;
  
  try {
    // Try a simple query to check if the database is set up
    const { error } = await supabase
      .from('content_entries')
      .select('id')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get search analytics
 */
export async function getSearchAnalytics(): Promise<any> {
  const clients = initializeClients();
  if (!clients) return null;

  const { supabase } = clients;

  try {
    const { data, error } = await supabase
      .from('search_analytics')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Analytics fetch failed:', error);
    return null;
  }
}