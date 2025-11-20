import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function checkContextBasedArticle() {
  console.log('🔍 Checking for context-based design systems article...\n');

  // Search by title
  const { data: entries, error: searchError } = await supabase
    .from('content_entries')
    .select('id, title, source_location, category, tags, embedding')
    .ilike('title', '%context-based%');

  if (searchError) {
    console.error('❌ Error:', searchError);
    return;
  }

  console.log(`Found ${entries.length} entries with "context-based" in title:\n`);

  entries.forEach(entry => {
    console.log('  Title:', entry.title);
    console.log('  ID:', entry.id);
    console.log('  Source:', entry.source_location);
    console.log('  Category:', entry.category);
    console.log('  Tags:', entry.tags);
    console.log('  Has Embedding:', entry.embedding ? 'YES' : 'NO');
    console.log('');
  });

  if (entries.length === 0) {
    console.log('❌ Article not found in database!\n');
    console.log('Checking JSON files in content/entries...');
    return;
  }

  // Test vector search
  console.log('\n🔍 Testing vector search for "context-based design systems"...\n');

  const queryText = 'context-based design systems';
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data: searchResults, error: vectorError } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_threshold: 0.15,
    match_count: 10
  });

  if (vectorError) {
    console.error('❌ Vector search error:', vectorError);
    return;
  }

  console.log(`Found ${searchResults.length} results:\n`);

  searchResults.forEach((result: any, idx: number) => {
    const isContextBased = result.title.toLowerCase().includes('context-based');
    console.log(`${idx + 1}. ${isContextBased ? '🎯' : '  '} ${result.title}`);
    console.log(`   Similarity: ${result.rank?.toFixed(4)}`);
    console.log(`   Source: ${result.source_location?.substring(0, 60)}...`);
    console.log('');
  });
}

checkContextBasedArticle().catch(console.error);
