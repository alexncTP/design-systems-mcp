/**
 * Retry failed entries from ingestion
 * Targets the 11 entries that failed due to network issues
 */

import { ingestContent } from '../src/lib/vector-ingestion';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function retryFailed() {
  console.log('🔄 Retrying failed entries...\n');

  // Check current counts
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  const { count: entriesCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  const { count: chunksCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Current Database State:');
  console.log(`   Entries: ${entriesCount}/104`);
  console.log(`   Chunks: ${chunksCount}`);
  console.log();

  if (entriesCount === 104) {
    console.log('✅ All 104 entries already ingested!');
    return;
  }

  const missing = 104 - (entriesCount || 0);
  console.log(`⚠️  ${missing} entries missing. Retrying ingestion...\n`);

  // Retry with slightly slower batch size to avoid rate limits
  const result = await ingestContent({
    batchSize: 5,  // Slower to avoid rate limits
    chunkSize: 1000,
    clearExisting: false,  // Don't clear - we want to keep successful ones
    verbose: true,
  });

  console.log('\n📊 Final Results:');
  console.log(`✅ Total successful: ${result.successful}/${result.total}`);
  console.log(`❌ Total failed: ${result.failed}`);
  console.log(`💰 Cost: $${result.cost.toFixed(4)}`);
  console.log(`⏱️  Duration: ${result.duration.toFixed(2)}s`);

  // Check final counts
  const { count: finalEntries } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  const { count: finalChunks } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 Final Database State:');
  console.log(`   Entries: ${finalEntries}/104`);
  console.log(`   Chunks: ${finalChunks}`);

  if (finalEntries === 104) {
    console.log('\n🎉 SUCCESS! All 104 entries ingested!');
  } else {
    console.log(`\n⚠️  Still missing ${104 - (finalEntries || 0)} entries`);
    if (result.errors.length > 0) {
      console.log('\nFailed entries:');
      result.errors.forEach(err => {
        console.log(`  - ${err.id}: ${err.error}`);
      });
    }
  }
}

retryFailed().catch(console.error);
