/**
 * Content Manager with Vector Search Integration
 * Provides backwards-compatible search with automatic fallback
 */

import { ContentEntry, SearchOptions } from '../../types/content';
import { 
  searchEntries as searchEntriesOriginal, 
  searchChunks as searchChunksOriginal,
  normalizeSearchTerms 
} from './content-manager';
import { 
  searchEntriesVector, 
  searchChunksVector, 
  isVectorSearchAvailable,
  VectorSearchOptions 
} from './vector-search';

// Performance monitoring
const searchMetrics = {
  vectorSearches: 0,
  fallbackSearches: 0,
  averageVectorTime: 0,
  averageFallbackTime: 0,
  vectorSuccessRate: 0,
};

/**
 * Enhanced search that tries vector search first, falls back to keyword search
 */
export async function searchEntries(options: SearchOptions = {}): Promise<ContentEntry[]> {
  const startTime = Date.now();
  const { query, category, tags, confidence, limit = 50 } = options;

  // Check if vector search is enabled
  const vectorEnabled = process.env.VECTOR_SEARCH_ENABLED === 'true';
  const useVectorFallback = process.env.USE_VECTOR_FALLBACK !== 'false';
  
  if (vectorEnabled && query) {
    try {
      // Check if vector search is available
      const isAvailable = await isVectorSearchAvailable();
      
      if (isAvailable) {
        // Try vector search
        const vectorOptions: VectorSearchOptions = {
          query,
          mode: process.env.VECTOR_SEARCH_MODE as 'vector' | 'text' | 'hybrid' || 'hybrid',
          category,
          tags,
          confidence,
          limit,
          threshold: parseFloat(process.env.VECTOR_SEARCH_THRESHOLD || '0.7'),
        };

        const vectorResults = await searchEntriesVector(vectorOptions);
        
        if (vectorResults.length > 0) {
          // Update metrics
          searchMetrics.vectorSearches++;
          const duration = Date.now() - startTime;
          searchMetrics.averageVectorTime = 
            (searchMetrics.averageVectorTime * (searchMetrics.vectorSearches - 1) + duration) / 
            searchMetrics.vectorSearches;
          searchMetrics.vectorSuccessRate = 
            (searchMetrics.vectorSuccessRate * (searchMetrics.vectorSearches - 1) + 1) / 
            searchMetrics.vectorSearches;

          if (process.env.LOG_SEARCH_PERFORMANCE === 'true') {
            console.log(`🎯 Vector search: ${vectorResults.length} results in ${duration}ms`);
          }

          // Return vector search results
          return vectorResults.map(r => r.entry);
        }
      }
    } catch (error) {
      console.error('Vector search error, falling back:', error);
    }
  }

  // Fallback to original keyword search
  if (useVectorFallback || !vectorEnabled) {
    const fallbackStartTime = Date.now();
    const results = searchEntriesOriginal(options);
    
    // Update metrics
    searchMetrics.fallbackSearches++;
    const duration = Date.now() - fallbackStartTime;
    searchMetrics.averageFallbackTime = 
      (searchMetrics.averageFallbackTime * (searchMetrics.fallbackSearches - 1) + duration) / 
      searchMetrics.fallbackSearches;

    if (process.env.LOG_SEARCH_PERFORMANCE === 'true') {
      console.log(`🔍 Fallback search: ${results.length} results in ${duration}ms`);
    }

    return results;
  }

  return [];
}

/**
 * Enhanced chunk search with vector support
 */
export async function searchChunks(
  query: string, 
  limit: number = 5
): Promise<Array<{ entry: ContentEntry; chunk: any; score: number }>> {
  const vectorEnabled = process.env.VECTOR_SEARCH_ENABLED === 'true';
  
  if (vectorEnabled) {
    try {
      const isAvailable = await isVectorSearchAvailable();
      
      if (isAvailable) {
        const threshold = parseFloat(process.env.VECTOR_SEARCH_THRESHOLD || '0.7');
        const vectorResults = await searchChunksVector(query, limit, threshold);
        
        if (vectorResults.length > 0) {
          if (process.env.LOG_SEARCH_PERFORMANCE === 'true') {
            console.log(`🎯 Vector chunk search: ${vectorResults.length} results`);
          }
          return vectorResults;
        }
      }
    } catch (error) {
      console.error('Vector chunk search error, falling back:', error);
    }
  }

  // Fallback to original chunk search
  const results = searchChunksOriginal(query, limit);
  
  if (process.env.LOG_SEARCH_PERFORMANCE === 'true') {
    console.log(`🔍 Fallback chunk search: ${results.length} results`);
  }
  
  return results;
}

/**
 * Get search performance metrics
 */
export function getSearchMetrics() {
  return {
    ...searchMetrics,
    vectorSearchPercentage: searchMetrics.vectorSearches > 0 
      ? (searchMetrics.vectorSearches / (searchMetrics.vectorSearches + searchMetrics.fallbackSearches)) * 100
      : 0,
    averageSpeedImprovement: searchMetrics.averageFallbackTime > 0 && searchMetrics.averageVectorTime > 0
      ? ((searchMetrics.averageFallbackTime - searchMetrics.averageVectorTime) / searchMetrics.averageFallbackTime) * 100
      : 0,
  };
}

/**
 * Export original functions for compatibility
 */
export { 
  loadEntries,
  getEntriesByCategory,
  getAllTags,
  getEntryById,
  normalizeSearchTerms,
} from './content-manager';

// Re-export types
export type { SearchOptions } from '../../types/content';