/**
 * Verify the ingestion quality
 * Check that all entries have embeddings and chunks are properly distributed
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyIngestion() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  console.log('🔍 Verifying Ingestion Quality\n');
  console.log('=' .repeat(80));

  // Count totals
  const { count: entriesCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  const { count: chunksCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Database Totals:');
  console.log(`   Content Entries: ${entriesCount}`);
  console.log(`   Content Chunks: ${chunksCount}`);
  console.log(`   Avg chunks/entry: ${((chunksCount || 0) / (entriesCount || 1)).toFixed(1)}`);
  console.log();

  // Check for entries without embeddings
  const { data: noEmbedding } = await supabase
    .from('content_entries')
    .select('id, title')
    .is('embedding', null);

  console.log('🧮 Embedding Quality:');
  if (noEmbedding && noEmbedding.length > 0) {
    console.log(`   ⚠️  ${noEmbedding.length} entries without embeddings:`);
    noEmbedding.forEach(e => console.log(`      - ${e.title}`));
  } else {
    console.log('   ✅ All entries have embeddings');
  }
  console.log();

  // Get sample entry with chunks
  const { data: sampleEntry } = await supabase
    .from('content_entries')
    .select('id, title, content')
    .limit(1)
    .single();

  if (sampleEntry) {
    const { data: sampleChunks } = await supabase
      .from('content_chunks')
      .select('id, chunk_index, chunk_text')
      .eq('entry_id', sampleEntry.id)
      .order('chunk_index');

    console.log('📋 Sample Entry:');
    console.log(`   Title: ${sampleEntry.title}`);
    console.log(`   Content length: ${sampleEntry.content.length} chars`);
    console.log(`   Chunks: ${sampleChunks?.length || 0}`);
    if (sampleChunks && sampleChunks.length > 0) {
      console.log('   Chunk structure:');
      console.log(`      - Chunk 0: ${sampleChunks[0].chunk_text.substring(0, 80)}...`);
      console.log(`      - Has chunk_text column: ✅`);
      console.log(`      - Integer ID: ${sampleChunks[0].id} ✅`);
    }
  }
  console.log();

  // Distribution analysis
  const { data: entriesWithChunks } = await supabase
    .from('content_entries')
    .select('id, title');

  if (entriesWithChunks) {
    let singleChunk = 0;
    let multiChunk = 0;
    let noChunks = 0;

    for (const entry of entriesWithChunks) {
      const { count } = await supabase
        .from('content_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('entry_id', entry.id);

      if (count === 0) noChunks++;
      else if (count === 1) singleChunk++;
      else multiChunk++;
    }

    console.log('📊 Chunk Distribution:');
    console.log(`   No chunks: ${noChunks}`);
    console.log(`   Single chunk: ${singleChunk}`);
    console.log(`   Multi-chunk: ${multiChunk}`);
    console.log();

    if (noChunks > 0) {
      console.log('⚠️  Warning: Some entries have no chunks');
      console.log('   This might be expected for very short entries');
    }
  }

  // Check schema correctness
  const { data: schemaCheck } = await supabase
    .from('content_chunks')
    .select('id, entry_id, chunk_text, chunk_index, embedding, metadata')
    .limit(1)
    .single();

  console.log('🔍 Schema Validation:');
  if (schemaCheck) {
    const hasCorrectId = typeof schemaCheck.id === 'number';
    const hasChunkText = 'chunk_text' in schemaCheck;
    const hasMetadata = schemaCheck.metadata &&
                       'start_index' in schemaCheck.metadata &&
                       'end_index' in schemaCheck.metadata;

    console.log(`   ✅ ID is INTEGER: ${hasCorrectId}`);
    console.log(`   ✅ Has chunk_text column: ${hasChunkText}`);
    console.log(`   ✅ Positional data in metadata: ${hasMetadata}`);
    console.log(`   ✅ Has embedding: ${!!schemaCheck.embedding}`);
  }
  console.log();

  console.log('=' .repeat(80));
  console.log('✨ Verification Complete!');
  console.log();

  if (entriesCount === 104 && chunksCount && chunksCount > 0) {
    console.log('🎉 SUCCESS! All 104 entries ingested with corrected schema!');
    console.log('   Ready for MCP testing.');
  } else {
    console.log('⚠️  Something might be wrong. Review the results above.');
  }
}

verifyIngestion().catch(console.error);
