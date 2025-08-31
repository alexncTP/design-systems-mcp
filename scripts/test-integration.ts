#!/usr/bin/env tsx
/**
 * Test complete integration: MCP + Vector Search
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function testIntegration() {
  console.log('🧪 Testing Complete Integration\n');
  console.log('=' .repeat(70));
  
  // 1. Check database content
  console.log('\n📊 1. Database Status:');
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
  
  console.log(`   Total entries: ${totalEntries}`);
  console.log(`   With embeddings: ${withEmbeddings}`);
  console.log(`   Total chunks: ${totalChunks}`);
  
  if (!totalEntries || totalEntries === 0) {
    console.error('❌ No entries in database. Run ingestion first.');
    return;
  }
  
  // 2. Test MCP server
  console.log('\n🔌 2. MCP Server Test:');
  
  const testQueries = [
    'what are design tokens',
    'accessibility best practices',
    'button component guidelines',
    'organizing Figma files'
  ];
  
  for (const query of testQueries) {
    try {
      const response = await fetch('http://localhost:8787/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_design_knowledge',
            arguments: { query, limit: 3 }
          },
          id: 1
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        console.log(`   ❌ Query "${query}": ${result.error.message}`);
      } else if (result.result?.content?.[0]?.text) {
        // Extract number of results from the response
        const match = result.result.content[0].text.match(/FOUND (\d+) RESULTS/);
        const numResults = match ? match[1] : '0';
        console.log(`   ✅ Query "${query}": ${numResults} results found`);
      } else {
        console.log(`   ⚠️  Query "${query}": Unexpected response format`);
      }
    } catch (error) {
      console.log(`   ❌ Query "${query}": ${error.message}`);
    }
  }
  
  // 3. Test direct vector search
  console.log('\n🎯 3. Direct Vector Search Test:');
  
  try {
    const { VectorSearch } = await import('../src/lib/vector-search');
    const vectorSearch = new VectorSearch(supabase);
    
    const testQuery = 'design system components';
    const results = await vectorSearch.search(testQuery, {
      mode: 'hybrid',
      limit: 5
    });
    
    console.log(`   Query: "${testQuery}"`);
    console.log(`   Results: ${results.length} found`);
    if (results.length > 0) {
      results.slice(0, 3).forEach((r, i) => {
        console.log(`   ${i+1}. ${r.title} (${r.similarity ? (r.similarity * 100).toFixed(1) + '%' : 'N/A'})`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Vector search error: ${error.message}`);
  }
  
  // 4. Verify environment configuration
  console.log('\n⚙️  4. Environment Configuration:');
  console.log(`   VECTOR_SEARCH_ENABLED: ${process.env.VECTOR_SEARCH_ENABLED || 'not set'}`);
  console.log(`   VECTOR_SEARCH_MODE: ${process.env.VECTOR_SEARCH_MODE || 'not set'}`);
  console.log(`   VECTOR_SEARCH_THRESHOLD: ${process.env.VECTOR_SEARCH_THRESHOLD || 'not set'}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  
  console.log('\n✨ Integration test complete!');
}

testIntegration().catch(console.error);