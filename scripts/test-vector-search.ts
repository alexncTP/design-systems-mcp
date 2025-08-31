#!/usr/bin/env tsx
/**
 * Test script for vector search functionality
 */

import { config } from 'dotenv';
import { searchEntriesVector, isVectorSearchAvailable } from '../src/lib/vector-search';

// Load environment variables
config();

const testQueries = [
  "what are slots?",
  "explain single source of truth",
  "what are design tokens?",
  "how do design systems work?",
  "what is atomic design?",
  "explain accessibility in design",
  "what are breakpoints?",
  "how to create components?",
  "what is a pattern library?",
  "explain typography in design systems"
];

async function testVectorSearch() {
  console.log('🧪 Testing Vector Search Functionality\n');
  
  // Check if vector search is available
  const isAvailable = await isVectorSearchAvailable();
  
  if (!isAvailable) {
    console.error('❌ Vector search is not available!');
    console.error('Please check:');
    console.error('1. Supabase credentials in .env file');
    console.error('2. Database schema is created');
    console.error('3. Content is ingested (run: npm run ingest:vectors)');
    process.exit(1);
  }
  
  console.log('✅ Vector search is available\n');
  console.log('Running test queries...\n');
  
  for (const query of testQueries) {
    console.log(`📝 Query: "${query}"`);
    
    try {
      const startTime = Date.now();
      
      const results = await searchEntriesVector({
        query,
        mode: 'hybrid',
        limit: 5,
        threshold: 0.7
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`   Results: ${results.length} found in ${duration}ms`);
      
      if (results.length > 0) {
        // Show top 3 results
        results.slice(0, 3).forEach((result, i) => {
          const relevanceEmoji = 
            result.relevance === 'high' ? '🟢' :
            result.relevance === 'medium' ? '🟡' : '🔴';
          
          console.log(`   ${i + 1}. ${relevanceEmoji} ${result.entry.title} (score: ${result.score.toFixed(3)})`);
        });
      } else {
        console.log('   ⚠️  No results found');
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
    
    console.log('');
  }
  
  // Test semantic understanding
  console.log('🧠 Testing Semantic Understanding:\n');
  
  const semanticTests = [
    { query: "placeholders in components", expected: "slots" },
    { query: "centralized reference point", expected: "single source of truth" },
    { query: "reusable UI elements", expected: "components" },
    { query: "visual consistency", expected: "design system" }
  ];
  
  for (const test of semanticTests) {
    console.log(`📝 "${test.query}" should relate to "${test.expected}"`);
    
    const results = await searchEntriesVector({
      query: test.query,
      mode: 'vector',
      limit: 5,
      threshold: 0.6
    });
    
    const found = results.some(r => 
      r.entry.title.toLowerCase().includes(test.expected) ||
      r.entry.content.toLowerCase().includes(test.expected)
    );
    
    if (found) {
      console.log(`   ✅ Semantic match found!`);
    } else {
      console.log(`   ⚠️  No semantic match (might need lower threshold)`);
    }
    console.log('');
  }
  
  console.log('✨ Vector search testing complete!');
}

// Run tests
testVectorSearch().catch(console.error);