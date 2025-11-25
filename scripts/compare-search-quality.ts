#!/usr/bin/env tsx

/**
 * Search quality comparison script
 * Compares vector search vs fallback search for various test queries
 */

import { VectorSearchProvider, createVectorSearchProvider } from '../src/lib/vector-search.js';
import { searchEntries as fallbackSearch } from '../src/lib/content-manager.js';
import type { ContentEntry } from '../types/content';

// Test queries with expected characteristics
const TEST_QUERIES = [
  {
    query: "slots in components",
    description: "Semantic: slots should match placeholders/properties",
    expectedSemantic: true,
    category: "semantic",
  },
  {
    query: "design tokens",
    description: "Exact match: should work well in both systems",
    expectedSemantic: false,
    category: "exact",
  },
  {
    query: "button accessibility",
    description: "Multi-concept: combining UI component with feature",
    expectedSemantic: true,
    category: "multi-concept",
  },
  {
    query: "placeholders in forms",
    description: "Semantic: placeholders should match input fields",
    expectedSemantic: true,
    category: "semantic",
  },
  {
    query: "component properties figma",
    description: "Multi-term: specific tool + concept",
    expectedSemantic: false,
    category: "multi-term",
  },
  {
    query: "consistency in design",
    description: "Abstract concept: should find relevant principles",
    expectedSemantic: true,
    category: "abstract",
  },
  {
    query: "atomic design methodology",
    description: "Specific methodology: exact match expected",
    expectedSemantic: false,
    category: "methodology",
  },
  {
    query: "how to organize components",
    description: "Natural language: question format",
    expectedSemantic: true,
    category: "natural-language",
  },
];

interface SearchResult {
  query: string;
  vectorResults: ContentEntry[];
  fallbackResults: ContentEntry[];
  vectorTime: number;
  fallbackTime: number;
  vectorFirst: ContentEntry | null;
  fallbackFirst: ContentEntry | null;
  relevanceScore: {
    vector: number;
    fallback: number;
  };
}

async function loadFallbackContent(): Promise<void> {
  try {
    // Load content for fallback system
    const { loadAllContentEntries } = await import('../src/lib/content-loader.js');
    const { loadEntries } = await import('../src/lib/content-manager.js');
    
    const entries = await loadAllContentEntries();
    loadEntries(entries);
    console.log(`✅ Loaded ${entries.length} entries for fallback system`);
  } catch (error) {
    console.error('❌ Failed to load fallback content:', error);
    throw error;
  }
}

function calculateRelevanceScore(results: ContentEntry[], query: string): number {
  if (results.length === 0) return 0;
  
  const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  results.forEach((result, index) => {
    const weight = 1 / (index + 1); // Higher weight for earlier results
    maxPossibleScore += weight;
    
    const title = result.title.toLowerCase();
    const content = result.content.toLowerCase();
    
    let matchScore = 0;
    queryTerms.forEach(term => {
      if (title.includes(term)) matchScore += 2; // Title matches worth more
      if (content.includes(term)) matchScore += 1;
    });
    
    totalScore += matchScore * weight;
  });
  
  return maxPossibleScore > 0 ? Math.min(totalScore / maxPossibleScore, 1) : 0;
}

async function runSearchComparison(): Promise<SearchResult[]> {
  console.log('🔍 Starting search quality comparison...\n');
  
  // Initialize systems
  console.log('📂 Loading fallback content...');
  await loadFallbackContent();
  
  console.log('🔌 Initializing vector search...');
  const vectorSearch = createVectorSearchProvider({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
  
  const results: SearchResult[] = [];
  
  for (const testCase of TEST_QUERIES) {
    console.log(`\n🧪 Testing: "${testCase.query}"`);
    console.log(`   Category: ${testCase.category}`);
    console.log(`   Description: ${testCase.description}`);
    
    try {
      // Vector search
      const vectorStartTime = Date.now();
      const vectorResults = await vectorSearch.searchEntries({
        query: testCase.query,
        limit: 10,
        useVector: true,
        hybridSearch: true,
      });
      const vectorTime = Date.now() - vectorStartTime;
      
      // Fallback search
      const fallbackStartTime = Date.now();
      const fallbackResults = await fallbackSearch({
        query: testCase.query,
        limit: 10,
      });
      const fallbackTime = Date.now() - fallbackStartTime;
      
      // Calculate relevance scores
      const vectorRelevance = calculateRelevanceScore(vectorResults, testCase.query);
      const fallbackRelevance = calculateRelevanceScore(fallbackResults, testCase.query);
      
      const result: SearchResult = {
        query: testCase.query,
        vectorResults,
        fallbackResults,
        vectorTime,
        fallbackTime,
        vectorFirst: vectorResults[0] || null,
        fallbackFirst: fallbackResults[0] || null,
        relevanceScore: {
          vector: vectorRelevance,
          fallback: fallbackRelevance,
        },
      };
      
      results.push(result);
      
      // Print immediate results
      console.log(`   📊 Results:`);
      console.log(`      Vector: ${vectorResults.length} results in ${vectorTime}ms (relevance: ${(vectorRelevance * 100).toFixed(1)}%)`);
      console.log(`      Fallback: ${fallbackResults.length} results in ${fallbackTime}ms (relevance: ${(fallbackRelevance * 100).toFixed(1)}%)`);
      
      if (vectorResults[0]) {
        console.log(`      Vector #1: "${vectorResults[0].title}"`);
      }
      if (fallbackResults[0]) {
        console.log(`      Fallback #1: "${fallbackResults[0].title}"`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${testCase.query}":`, error);
    }
  }
  
  return results;
}

function generateReport(results: SearchResult[]): void {
  console.log('\n📋 SEARCH QUALITY COMPARISON REPORT');
  console.log('=====================================\n');
  
  // Summary statistics
  let vectorWins = 0;
  let fallbackWins = 0;
  let ties = 0;
  let totalVectorTime = 0;
  let totalFallbackTime = 0;
  let vectorTotalRelevance = 0;
  let fallbackTotalRelevance = 0;
  
  results.forEach(result => {
    totalVectorTime += result.vectorTime;
    totalFallbackTime += result.fallbackTime;
    vectorTotalRelevance += result.relevanceScore.vector;
    fallbackTotalRelevance += result.relevanceScore.fallback;
    
    if (result.relevanceScore.vector > result.relevanceScore.fallback) {
      vectorWins++;
    } else if (result.relevanceScore.fallback > result.relevanceScore.vector) {
      fallbackWins++;
    } else {
      ties++;
    }
  });
  
  console.log('📊 OVERALL STATISTICS');
  console.log(`Total queries tested: ${results.length}`);
  console.log(`Vector search wins: ${vectorWins}`);
  console.log(`Fallback search wins: ${fallbackWins}`);
  console.log(`Ties: ${ties}`);
  console.log(`\nAverage Performance:`);
  console.log(`  Vector: ${(totalVectorTime / results.length).toFixed(0)}ms, ${(vectorTotalRelevance / results.length * 100).toFixed(1)}% relevance`);
  console.log(`  Fallback: ${(totalFallbackTime / results.length).toFixed(0)}ms, ${(fallbackTotalRelevance / results.length * 100).toFixed(1)}% relevance`);
  
  // Detailed results
  console.log('\n📝 DETAILED RESULTS');
  console.log('Query | Vector Rel. | Fallback Rel. | Winner | Vector Time | Fallback Time');
  console.log('------|-------------|---------------|---------|-------------|---------------');
  
  results.forEach(result => {
    const vectorRel = (result.relevanceScore.vector * 100).toFixed(1);
    const fallbackRel = (result.relevanceScore.fallback * 100).toFixed(1);
    const winner = result.relevanceScore.vector > result.relevanceScore.fallback 
      ? 'Vector' 
      : result.relevanceScore.fallback > result.relevanceScore.vector 
        ? 'Fallback' 
        : 'Tie';
    
    console.log(
      `${result.query.padEnd(25, ' ')} | ${vectorRel.padStart(10, ' ')}% | ${fallbackRel.padStart(12, ' ')}% | ${winner.padEnd(7, ' ')} | ${result.vectorTime.toString().padStart(10, ' ')}ms | ${result.fallbackTime.toString().padStart(12, ' ')}ms`
    );
  });
  
  // Category analysis
  console.log('\n📈 CATEGORY ANALYSIS');
  const categoryStats: { [key: string]: { vector: number; fallback: number; count: number } } = {};
  
  TEST_QUERIES.forEach((testCase, index) => {
    const result = results[index];
    if (!result) return;
    
    if (!categoryStats[testCase.category]) {
      categoryStats[testCase.category] = { vector: 0, fallback: 0, count: 0 };
    }
    
    categoryStats[testCase.category].vector += result.relevanceScore.vector;
    categoryStats[testCase.category].fallback += result.relevanceScore.fallback;
    categoryStats[testCase.category].count++;
  });
  
  console.log('Category | Vector Avg | Fallback Avg | Improvement');
  console.log('---------|------------|--------------|-------------');
  
  Object.entries(categoryStats).forEach(([category, stats]) => {
    const vectorAvg = (stats.vector / stats.count * 100).toFixed(1);
    const fallbackAvg = (stats.fallback / stats.count * 100).toFixed(1);
    const improvement = ((stats.vector - stats.fallback) / stats.fallback * 100).toFixed(1);
    
    console.log(
      `${category.padEnd(8, ' ')} | ${vectorAvg.padStart(9, ' ')}% | ${fallbackAvg.padStart(11, ' ')}% | ${improvement.padStart(10, ' ')}%`
    );
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  
  if (vectorWins > fallbackWins) {
    console.log('✅ Vector search shows superior performance overall');
    console.log('   Recommendation: Proceed with migration to vector search');
  } else {
    console.log('⚠️ Fallback search performs better in current tests');
    console.log('   Recommendation: Review vector search configuration or thresholds');
  }
  
  if (totalVectorTime / results.length > 500) {
    console.log('⚠️ Vector search response times exceed 500ms target');
    console.log('   Consider: Optimizing database queries or using caching');
  }
  
  const semanticTests = results.filter((_, index) => TEST_QUERIES[index].expectedSemantic);
  const semanticVectorWins = semanticTests.filter(result => 
    result.relevanceScore.vector > result.relevanceScore.fallback
  ).length;
  
  if (semanticVectorWins / semanticTests.length > 0.8) {
    console.log('✅ Vector search excels at semantic queries as expected');
  } else {
    console.log('⚠️ Vector search underperforms on semantic queries');
    console.log('   Consider: Adjusting similarity thresholds or embedding model');
  }
}

async function main(): Promise<void> {
  try {
    // Validate environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.OPENAI_API_KEY) {
      console.error('❌ Missing required environment variables');
      console.error('Required: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY');
      process.exit(1);
    }
    
    const results = await runSearchComparison();
    generateReport(results);
    
  } catch (error) {
    console.error('❌ Search comparison failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}