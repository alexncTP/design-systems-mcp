/**
 * Unified search handler that checks Supabase first, falls back to local
 * Includes source reliability enrichment for content quality transparency
 */

import { type ContentEntry, type SearchOptions, Category } from '../../types/content';
import { searchEntries as searchEntriesLocal } from './content-manager';
import {
  getSourceReliability,
  requiresAccessibilityCaveats,
  getAccessibilityGuidanceDisclaimer,
  formatReliabilityBadge
} from './source-authority';

/**
 * Enrich a content entry with source reliability information
 */
function enrichWithReliability(entry: ContentEntry): ContentEntry {
  const sourceLocation = entry.source?.location || entry.metadata?.source_url || '';
  const reliability = getSourceReliability(sourceLocation);

  // Create enriched metadata
  const enrichedMetadata = {
    ...entry.metadata,
    reliability,
    reliabilityBadge: formatReliabilityBadge(reliability.level)
  };

  // Add important note if source requires caveats (like APG)
  if (reliability.importantNote) {
    enrichedMetadata.importantNote = reliability.importantNote;
  }

  // Adjust confidence based on reliability level
  // APG and reference implementations should not be marked as "high" confidence for accessibility
  if (reliability.level === 'reference' && entry.metadata.confidence === 'high') {
    if (requiresAccessibilityCaveats(sourceLocation)) {
      enrichedMetadata.confidence = 'medium';
    }
  }

  return {
    ...entry,
    metadata: enrichedMetadata
  };
}

/**
 * Check if any results contain APG/ARIA content that needs disclaimers
 */
function resultsContainAPGContent(results: ContentEntry[]): boolean {
  return results.some(entry => {
    const sourceLocation = entry.source?.location || entry.metadata?.source_url || '';
    return requiresAccessibilityCaveats(sourceLocation);
  });
}

export async function searchWithSupabase(options: SearchOptions = {}, env?: any): Promise<ContentEntry[]> {
  const { query, category, tags: filterTags, confidence, limit = 50 } = options;

  // Get environment variables from either process.env or Cloudflare env
  const vectorEnabled = env?.VECTOR_SEARCH_ENABLED || process.env.VECTOR_SEARCH_ENABLED;
  const vectorSearchMode = env?.VECTOR_SEARCH_MODE || process.env.VECTOR_SEARCH_MODE || 'text';
  const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = env?.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const logPerformance = (env?.LOG_SEARCH_PERFORMANCE || process.env.LOG_SEARCH_PERFORMANCE) === 'true';

  // DEBUG: Log environment variable status to diagnose credential issues
  if (logPerformance) {
    console.log('[Vector Search] Checking credentials...');
    console.log('[Vector Search] vectorEnabled:', vectorEnabled);
    console.log('[Vector Search] vectorSearchMode:', vectorSearchMode);
    console.log('[Vector Search] supabaseUrl:', supabaseUrl ? 'SET (' + supabaseUrl.substring(0, 30) + '...)' : 'MISSING');
    console.log('[Vector Search] supabaseKey:', supabaseKey ? 'SET (length: ' + supabaseKey.length + ')' : 'MISSING');
    console.log('[Vector Search] openaiKey:', openaiKey ? 'SET (length: ' + openaiKey.length + ')' : 'MISSING');
    console.log('[Vector Search] Condition check:', query ? 'query=YES' : 'query=NO', vectorEnabled === 'true' ? 'enabled=YES' : 'enabled=' + vectorEnabled, vectorSearchMode === 'vector' ? 'mode=YES' : 'mode=' + vectorSearchMode);
  }

  // Check if we should use Supabase vector search
  if (query && vectorEnabled === 'true' && vectorSearchMode === 'vector') {
    try {
      // Try to connect to Supabase
      const { createClient } = require('@supabase/supabase-js');

      if (supabaseUrl && supabaseKey && openaiKey) {
        if (logPerformance) {
          console.log('[Vector Search] ✅ All credentials present, proceeding with vector search...');
        }
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
        // Lower threshold to 0.15 for better recall - retrieves more relevant results
        const { data, error } = await supabase.rpc('search_content', {
          query_embedding: queryEmbedding,
          query_text: query, // Hybrid search
          match_threshold: 0.15,
          match_count: limit,
          filter_category: category,
          filter_tags: filterTags
        });

        if (!error && data && data.length > 0) {
          if (logPerformance) {
            console.log(`[Vector Search] Found ${data.length} results`);
          }

          // Convert Supabase results to ContentEntry format and enrich with reliability
          const results = data.map((row: any) => {
            const entry: ContentEntry = {
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
            };
            // Enrich with source reliability information
            return enrichWithReliability(entry);
          });

          return results;
        }

        if (error && logPerformance) {
          console.error('[Vector Search] Supabase error:', error.message);
        }
      } else if (logPerformance) {
        console.log('[Vector Search] ❌ Credential check FAILED - one or more required credentials missing');
        console.log('[Vector Search] supabaseUrl:', supabaseUrl ? 'OK' : '❌ MISSING');
        console.log('[Vector Search] supabaseKey:', supabaseKey ? 'OK' : '❌ MISSING');
        console.log('[Vector Search] openaiKey:', openaiKey ? 'OK' : '❌ MISSING');
      }
    } catch (error: any) {
      if (logPerformance) {
        console.error('[Vector Search] Error:', error?.message || 'Unknown error');
      }
      // Continue to fallback
    }
  }

  // Fallback to local keyword search
  if (logPerformance) {
    console.log('[Search] Using local keyword search');
  }
  const localResults = searchEntriesLocal(options);

  // Enrich local results with reliability information
  return localResults.map(entry => enrichWithReliability(entry));
}

/**
 * Export helper functions for use in tool formatting
 */
export { resultsContainAPGContent, getAccessibilityGuidanceDisclaimer };
