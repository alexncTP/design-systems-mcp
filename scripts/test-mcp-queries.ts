#!/usr/bin/env tsx
/**
 * Test MCP queries and verify Supabase source
 */

import { performance } from 'perf_hooks';

const testQueries = [
  "What are slots?",
  "What is atomic design?",
  "What are typical properties that you would find on a button component?",
  "Tell me about single source of truth",
  "What are design system best practices?",
  "Brad Frost atomic design", // Control query we know is in Supabase
];

async function testMcpQuery(query: string): Promise<{ results: number; time: number; titles: string[] }> {
  const start = performance.now();
  
  try {
    const response = await fetch('http://localhost:8787/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_design_knowledge',
          arguments: { 
            query,
            limit: 5 
          }
        },
        id: 1
      })
    });
    
    const result = await response.json();
    const time = performance.now() - start;
    
    if (result.result?.content?.[0]?.text) {
      // Extract number of results
      const match = result.result.content[0].text.match(/FOUND (\d+) RESULTS/);
      const numResults = match ? parseInt(match[1]) : 0;
      
      // Extract titles
      const titles: string[] = [];
      const titleMatches = result.result.content[0].text.matchAll(/<strong>🔍 \d+\. ([^<]+)<\/strong>/g);
      for (const match of titleMatches) {
        titles.push(match[1].trim());
      }
      
      return { results: numResults, time, titles };
    }
    
    return { results: 0, time, titles: [] };
  } catch (error) {
    console.error(`Error for query "${query}":`, error.message);
    return { results: 0, time: performance.now() - start, titles: [] };
  }
}

async function runTests() {
  console.log('🧪 Testing MCP Queries with Supabase Vector Search\n');
  console.log('=' .repeat(70));
  
  let totalTime = 0;
  const results: any[] = [];
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(60));
    
    const { results: numResults, time, titles } = await testMcpQuery(query);
    totalTime += time;
    
    console.log(`⏱️  Response time: ${time.toFixed(0)}ms`);
    console.log(`📊 Results found: ${numResults}`);
    
    if (titles.length > 0) {
      console.log('📚 Top results:');
      titles.slice(0, 3).forEach((title, i) => {
        console.log(`   ${i + 1}. ${title}`);
      });
    }
    
    results.push({ query, numResults, time, titles });
  }
  
  console.log('\n\n📊 Performance Summary\n');
  console.log('=' .repeat(70));
  console.log(`Average response time: ${(totalTime / testQueries.length).toFixed(0)}ms`);
  console.log(`Total queries: ${testQueries.length}`);
  console.log(`Queries with results: ${results.filter(r => r.numResults > 0).length}`);
  
  // Check for Brad Frost content (proof of Supabase)
  const bradFrostResult = results.find(r => r.query.includes('Brad Frost'));
  if (bradFrostResult && bradFrostResult.titles[0]?.includes('Brad Frost')) {
    console.log('\n✅ CONFIRMED: Brad Frost article from Supabase is being returned');
    console.log('   This content was ingested via URL and only exists in Supabase, not JSON files');
  }
  
  // Performance analysis
  console.log('\n⚡ Performance Analysis:');
  const slowQueries = results.filter(r => r.time > 2000);
  if (slowQueries.length > 0) {
    console.log(`\n⚠️  Slow queries (>2s):`);
    slowQueries.forEach(q => {
      console.log(`   - "${q.query}": ${q.time.toFixed(0)}ms`);
    });
  }
  
  const fastQueries = results.filter(r => r.time < 1000);
  if (fastQueries.length > 0) {
    console.log(`\n✅ Fast queries (<1s):`);
    fastQueries.forEach(q => {
      console.log(`   - "${q.query}": ${q.time.toFixed(0)}ms`);
    });
  }
}

runTests().catch(console.error);