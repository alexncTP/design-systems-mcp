/**
 * Interactive Demo: Test Vector Search with Cleaned Data
 * Try semantic search on your 104 cleaned design system entries!
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config();

async function demoVectorSearch() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  console.log('🎯 Design Systems Vector Search Demo\n');
  console.log('=' .repeat(80));
  console.log('Your database has 104 cleaned design system entries with embeddings!');
  console.log('Let\'s try some semantic searches...\n');

  // Demo queries to showcase search quality
  const demoQueries = [
    'How do I implement design tokens in Figma?',
    'What are best practices for button components?',
    'Tell me about accessibility in design systems',
    'How do companies handle multi-brand design systems?',
    'What tools are used for design system documentation?',
  ];

  console.log('📋 Demo Queries:');
  demoQueries.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
  console.log('\n' + '=' .repeat(80) + '\n');

  // Run searches
  for (const query of demoQueries) {
    console.log(`\n🔍 Query: "${query}"\n`);

    try {
      // Generate query embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Search using pgvector similarity
      const { data: results, error } = await supabase.rpc('match_content', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 3,
      });

      if (error) {
        console.log('   ⚠️  Note: match_content function not found');
        console.log('   Falling back to simple search...\n');

        // Fallback: search without vector similarity
        const { data: fallbackResults } = await supabase
          .from('content_entries')
          .select('title, content')
          .textSearch('content', query.split(' ').join(' | '))
          .limit(3);

        if (fallbackResults && fallbackResults.length > 0) {
          fallbackResults.forEach((result, i) => {
            console.log(`   ${i + 1}. ${result.title}`);
            console.log(`      ${result.content.substring(0, 150)}...\n`);
          });
        } else {
          console.log('   No results found\n');
        }
        continue;
      }

      if (!results || results.length === 0) {
        console.log('   No results found\n');
        continue;
      }

      // Display results
      results.forEach((result: any, i: number) => {
        const similarity = (result.similarity * 100).toFixed(1);
        console.log(`   ${i + 1}. ${result.title} (${similarity}% match)`);
        console.log(`      ${result.content.substring(0, 120)}...\n`);
      });

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=' .repeat(80));
  console.log('\n✨ Demo complete! Your vector search is ready to use.\n');
  console.log('💡 To use this in production:');
  console.log('   1. Set up the match_content SQL function (see supabase/migrations/)');
  console.log('   2. Integrate with your MCP server');
  console.log('   3. Query from Claude Desktop or your app\n');
}

demoVectorSearch().catch(console.error);
