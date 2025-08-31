#!/usr/bin/env tsx
/**
 * Test website crawling with vector embeddings
 */

import { config } from 'dotenv';
import { performance } from 'perf_hooks';

config();

async function testWebsiteCrawl() {
  console.log('🕷️  Testing Website Crawl with Vector Embeddings\n');
  console.log('=' .repeat(70));
  
  const testUrl = 'https://bradfrost.com';
  const depth = 1; // Shallow crawl for testing
  
  console.log(`\n📍 Target: ${testUrl}`);
  console.log(`📊 Depth: ${depth}`);
  console.log(`⚙️  Mode: With vector embeddings\n`);
  
  // Check if crawl script exists
  try {
    const { crawlWebsite } = await import('./crawl-website');
    
    console.log('Starting crawl...\n');
    const startTime = performance.now();
    
    const results = await crawlWebsite(testUrl, {
      depth,
      maxPages: 5, // Limit for testing
      generateEmbeddings: true,
      saveToDatabase: true
    });
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n📊 Crawl Results:');
    console.log(`   Pages crawled: ${results.pagesProcessed}`);
    console.log(`   Embeddings generated: ${results.embeddingsGenerated}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Average time per page: ${(parseFloat(duration) / results.pagesProcessed).toFixed(2)}s`);
    
    if (results.errors && results.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      results.errors.forEach((err: any) => {
        console.log(`   - ${err}`);
      });
    }
    
    console.log('\n✅ Website crawl test completed!');
    
  } catch (error) {
    console.log('⚠️  Crawl script not found. Creating simple test...\n');
    
    // Fallback: Simple multi-URL test
    const urls = [
      'https://bradfrost.com/blog/post/atomic-web-design/',
      'https://bradfrost.com/blog/post/design-systems-are-for-user-interfaces/',
      'https://bradfrost.com/blog/post/extending-atomic-design/'
    ];
    
    console.log('Testing multiple URL ingestion:\n');
    
    for (const url of urls) {
      try {
        console.log(`📥 Fetching: ${url}`);
        
        // Use the ingest-url script
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout, stderr } = await execAsync(`npx tsx scripts/ingest-url-with-vectors.ts "${url}"`);
        
        if (stderr) {
          console.log(`   ❌ Error: ${stderr}`);
        } else {
          const match = stdout.match(/ID: ([a-f0-9-]+)/);
          if (match) {
            console.log(`   ✅ Ingested with ID: ${match[1]}`);
          } else {
            console.log(`   ✅ Ingested successfully`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n✅ Multi-URL ingestion test completed!');
  }
  
  // Test search across all ingested content
  console.log('\n🔍 Testing search across ingested content:');
  
  const { createClient } = await import('@supabase/supabase-js');
  const { default: OpenAI } = await import('openai');
  
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const testQueries = [
    'atomic design methodology',
    'design system components',
    'Brad Frost'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    
    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    
    const embedding = response.data[0].embedding;
    
    // Search
    const { data, error } = await supabase.rpc('search_content', {
      query_embedding: embedding,
      query_text: query,
      match_threshold: 0.3,
      match_count: 3
    });
    
    if (error) {
      console.log(`   ❌ Search error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`   Found ${data.length} results:`);
      data.forEach((r: any, i: number) => {
        console.log(`   ${i+1}. ${r.title} (${(r.rank * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('   No results found');
    }
  }
  
  console.log('\n✨ All tests completed!');
}

testWebsiteCrawl().catch(console.error);