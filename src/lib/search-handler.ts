/**
 * Unified search handler that checks Supabase first, falls back to local
 */

import { ContentEntry, SearchOptions, Category } from '../../types/content';
import { searchEntries as searchEntriesLocal } from './content-manager';

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;
  
  // Get environment variables from either process.env or Cloudflare env
  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED || process.env.VECTOR_SEARCH_ENABLED;
  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  // Check if we should use Supabase
  if (query && vectorEnabled === 'true') {
    try {
      // Try to connect to Supabase
      const { createClient } = require('@supabase/supabase-js');
      
      if (supabaseUrl && supabaseKey && openaiKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Generate embedding for the query
        const OpenAI = require('openai');
        const openai = new OpenAI.default({ apiKey: openaiKey });
        
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query.slice(0, 8191),
        });
        
        const queryEmbedding = embeddingResponse.data[0].embedding;
        
        // Search Supabase with vector similarity
        const { data, error } = await supabase.rpc('search_content', {
          query_embedding: queryEmbedding,
          query_text: query, // Hybrid search
          match_threshold: 0.3,
          match_count: limit,
          filter_category: category,
          filter_tags: filterTags
        });
        
        if (!error && data && data.length > 0) {
          console.log(`Vector search returned ${data.length} results from Supabase`);
          
          // Convert Supabase results to ContentEntry format
          return data.map((row: any) => ({
            id: row.id,
            title: row.title,
            content: row.content || '',
            source: {
              type: row.source_type || 'database',
              location: row.source_location || 'supabase',
              ingested_at: row.ingested_at || new Date().toISOString()
            },
            chunks: [],
            metadata: {
              category: row.category || 'general',
              tags: row.tags || [],
              confidence: row.confidence || confidence || 'medium',
              system: row.system_name || '',
              last_updated: row.updated_at || new Date().toISOString(),
              source_url: row.source_location || ''
            }
          }));
        }
      }
    } catch (error) {
      console.log('Vector search not available, falling back to local search:', error.message);
    }
  }
  
  // Fallback to local keyword search
  console.log('Using local keyword search');
  return searchEntriesLocal(options);
}