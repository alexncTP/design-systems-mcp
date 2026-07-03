/**
 * Quick Production Database Connection Test
 * Tests production Supabase credentials without requiring local instance
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testProductionConnection() {
  console.log('🧪 Testing Production Supabase Connection\n');

  const prodUrl = process.env.SUPABASE_PROD_URL;
  const prodKey = process.env.SUPABASE_PROD_SERVICE_KEY;

  if (!prodUrl || !prodKey) {
    console.error('❌ Production credentials not found in .env');
    console.error('   Please add SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY\n');
    process.exit(1);
  }

  console.log(`📍 Production URL: ${prodUrl}`);
  console.log(`🔑 Service Key: ${prodKey.substring(0, 20)}...\n`);

  try {
    const supabase = createClient(prodUrl, prodKey);

    console.log('📊 Fetching production database statistics...\n');

    // Test connection and get entry count
    const { data: entries, error: entriesError } = await supabase
      .from('content_entries')
      .select('id, title, updated_at, metadata')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (entriesError) {
      console.error('❌ Failed to fetch entries:', entriesError.message);
      console.error('   Error details:', entriesError);
      process.exit(1);
    }

    // Get total count
    const { count: totalEntries, error: countError } = await supabase
      .from('content_entries')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Failed to count entries:', countError.message);
      process.exit(1);
    }

    // Get chunk count
    const { count: totalChunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('*', { count: 'exact', head: true });

    if (chunksError) {
      console.error('❌ Failed to count chunks:', chunksError.message);
      process.exit(1);
    }

    // Get embedding stats
    const { count: entriesWithEmbeddings, error: embedError } = await supabase
      .from('content_entries')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    console.log('✅ Connection successful!\n');
    console.log('═'.repeat(60));
    console.log('📊 PRODUCTION DATABASE STATISTICS');
    console.log('═'.repeat(60));
    console.log(`\n   Total Entries: ${totalEntries}`);
    console.log(`   Total Chunks: ${totalChunks}`);
    console.log(`   Entries with Embeddings: ${entriesWithEmbeddings}`);

    if (totalEntries && totalEntries > 0) {
      const coverage = ((entriesWithEmbeddings || 0) / totalEntries * 100).toFixed(1);
      console.log(`   Embedding Coverage: ${coverage}%`);
    }

    if (entries && entries.length > 0) {
      console.log(`\n   Most Recent Update: ${entries[0]?.updated_at || 'Unknown'}`);

      console.log('\n   Recent Entries (latest 10):');
      entries.forEach((entry, idx) => {
        const category = entry.metadata?.category || 'unknown';
        const date = entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : 'N/A';
        console.log(`   ${idx + 1}. ${entry.title} (${category}) - ${date}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('💡 NEXT STEPS');
    console.log('═'.repeat(60));
    console.log('\n1. Start Docker Desktop');
    console.log('2. Start local Supabase: supabase start');
    console.log('3. Compare databases: npm run sync:compare');
    console.log('4. Pull production data: npm run sync:pull\n');

  } catch (error) {
    console.error('\n❌ Connection failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    process.exit(1);
  }
}

testProductionConnection();
