#!/usr/bin/env tsx
/**
 * Compare vector search with keyword search performance
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { performance } from 'perf_hooks';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Test queries for semantic understanding
const testQueries = [
  {
    query: 'what are slots in components?',
    expectedSemantic: ['placeholders', 'content areas', 'component properties'],
    description: 'Should understand slots conceptually'
  },
  {
    query: 'centralized reference point for design',
    expectedSemantic: ['single source of truth', 'design tokens', 'consistency'],
    description: 'Should match SSOT concept'
  },
  {
    query: 'reusable UI elements',
    expectedSemantic: ['components', 'design system', 'building blocks'],
    description: 'Should find component-related content'
  },
  {
    query: 'making designs accessible',
    expectedSemantic: ['accessibility', 'WCAG', 'a11y', 'inclusive'],
    description: 'Should find accessibility content'
  },
  {
    query: 'organizing Figma files',
    expectedSemantic: ['file structure', 'naming', 'organization'],
    description: 'Should find Figma organization content'
  }
];

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function vectorSearch(query: string, threshold: number = 0.4): Promise<any[]> {
  const embedding = await generateEmbedding(query);
  
  const { data, error } = await supabase.rpc('search_content', {
    query_embedding: embedding,
    query_text: null, // Pure vector search
    match_threshold: threshold,
    match_count: 10
  });
  
  if (error) throw error;
  return data || [];
}

async function textSearch(query: string): Promise<any[]> {
  // Generate a dummy embedding for the RPC call
  const dummyEmbedding = new Array(1536).fill(0);
  
  const { data, error } = await supabase.rpc('search_content', {
    query_embedding: dummyEmbedding,
    query_text: query, // Text search only
    match_threshold: 0.1,
    match_count: 10
  });
  
  if (error) throw error;
  return data || [];
}

async function hybridSearch(query: string, threshold: number = 0.4): Promise<any[]> {
  const embedding = await generateEmbedding(query);
  
  const { data, error } = await supabase.rpc('search_content', {
    query_embedding: embedding,
    query_text: query, // Both vector and text
    match_threshold: threshold,
    match_count: 10
  });
  
  if (error) throw error;
  return data || [];
}

async function runComparison() {
  console.log('🔬 Vector Search vs Keyword Search Comparison\n');
  console.log('=' .repeat(70));
  
  for (const test of testQueries) {
    console.log(`\n📝 Query: "${test.query}"`);
    console.log(`   ${test.description}`);
    console.log('-'.repeat(60));
    
    try {
      // Run all three search types
      const vectorStart = performance.now();
      const vectorResults = await vectorSearch(test.query);
      const vectorTime = performance.now() - vectorStart;
      
      const textStart = performance.now();
      const textResults = await textSearch(test.query);
      const textTime = performance.now() - textStart;
      
      const hybridStart = performance.now();
      const hybridResults = await hybridSearch(test.query);
      const hybridTime = performance.now() - hybridStart;
      
      // Display results
      console.log('\n🎯 Vector Search (Semantic):');
      if (vectorResults.length > 0) {
        vectorResults.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i+1}. ${r.title}`);
          console.log(`      Score: ${(r.rank * 100).toFixed(1)}%`);
        });
      } else {
        console.log('   No results');
      }
      
      console.log('\n📚 Text Search (Keywords):');
      if (textResults.length > 0) {
        textResults.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i+1}. ${r.title}`);
        });
      } else {
        console.log('   No results');
      }
      
      console.log('\n🔀 Hybrid Search (Combined):');
      if (hybridResults.length > 0) {
        hybridResults.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i+1}. ${r.title}`);
          console.log(`      Score: ${(r.rank * 100).toFixed(1)}%`);
        });
      } else {
        console.log('   No results');
      }
      
      // Performance comparison
      console.log('\n⚡ Performance:');
      console.log(`   Vector: ${vectorTime.toFixed(0)}ms (${vectorResults.length} results)`);
      console.log(`   Text: ${textTime.toFixed(0)}ms (${textResults.length} results)`);
      console.log(`   Hybrid: ${hybridTime.toFixed(0)}ms (${hybridResults.length} results)`);
      
      // Check semantic understanding
      const vectorTitles = vectorResults.map(r => r.title.toLowerCase()).join(' ');
      const foundConcepts = test.expectedSemantic.filter(concept => 
        vectorTitles.includes(concept.toLowerCase())
      );
      
      if (foundConcepts.length > 0) {
        console.log('\n✅ Semantic understanding confirmed:', foundConcepts.join(', '));
      } else {
        console.log('\n⚠️  Expected semantic matches not found directly in titles');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  // Overall statistics
  console.log('\n\n📊 Overall Performance Summary\n');
  console.log('=' .repeat(70));
  
  // Test cache performance
  const cacheQuery = 'design system components';
  console.log(`\nCache test with: "${cacheQuery}"`);
  
  const cold1 = performance.now();
  await vectorSearch(cacheQuery);
  const coldTime = performance.now() - cold1;
  
  const warm1 = performance.now();
  await vectorSearch(cacheQuery);
  const warmTime = performance.now() - warm1;
  
  console.log(`Cold cache: ${coldTime.toFixed(0)}ms`);
  console.log(`Warm cache: ${warmTime.toFixed(0)}ms`);
  console.log(`Speed improvement: ${((1 - warmTime/coldTime) * 100).toFixed(1)}%`);
  
  // Database statistics
  const { count: totalEntries } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });
    
  const { count: withEmbeddings } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);
    
  const { count: totalChunks } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n📈 Database Statistics:');
  console.log(`Total entries: ${totalEntries}`);
  console.log(`Entries with embeddings: ${withEmbeddings} (${((withEmbeddings!/totalEntries!) * 100).toFixed(1)}%)`);
  console.log(`Total chunks: ${totalChunks}`);
  
  console.log('\n✨ Comparison complete!');
}

runComparison().catch(console.error);