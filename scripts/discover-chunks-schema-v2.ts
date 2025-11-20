/**
 * Refined schema discovery based on initial findings:
 * - id is INTEGER (not TEXT)
 * - text column doesn't exist (try chunk_text, content, chunk_content)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function discoverChunksSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl!, supabaseKey!);

  console.log('🔍 Refined Schema Discovery for content_chunks\n');
  console.log('Known: id is INTEGER (not TEXT)\n');

  // Test 1: chunk_text with integer ID
  console.log('=' .repeat(80));
  console.log('Test 1: Integer ID + chunk_text + chunk_index');
  console.log('=' .repeat(80));

  const { error: error1 } = await supabase
    .from('content_chunks')
    .insert({
      entry_id: '61-2tFUCrvNdFWBsTYZMY',
      chunk_text: 'Test chunk content',
      chunk_index: 0,
      embedding: new Array(1536).fill(0),
      metadata: { test: true },
    });

  if (error1) {
    console.log('❌ Error:', error1.message);
  } else {
    console.log('✅ SUCCESS! Schema: integer id (auto), chunk_text, chunk_index');
  }
  console.log();

  // Test 2: content instead of chunk_text
  console.log('=' .repeat(80));
  console.log('Test 2: Integer ID + content + chunk_index');
  console.log('=' .repeat(80));

  const { error: error2 } = await supabase
    .from('content_chunks')
    .insert({
      entry_id: '61-2tFUCrvNdFWBsTYZMY',
      content: 'Test chunk content',
      chunk_index: 0,
      embedding: new Array(1536).fill(0),
      metadata: { test: true },
    });

  if (error2) {
    console.log('❌ Error:', error2.message);
  } else {
    console.log('✅ SUCCESS! Schema: integer id (auto), content, chunk_index');
  }
  console.log();

  // Test 3: chunk_content
  console.log('=' .repeat(80));
  console.log('Test 3: Integer ID + chunk_content + chunk_index');
  console.log('=' .repeat(80));

  const { error: error3 } = await supabase
    .from('content_chunks')
    .insert({
      entry_id: '61-2tFUCrvNdFWBsTYZMY',
      chunk_content: 'Test chunk content',
      chunk_index: 0,
      embedding: new Array(1536).fill(0),
      metadata: { test: true },
    });

  if (error3) {
    console.log('❌ Error:', error3.message);
  } else {
    console.log('✅ SUCCESS! Schema: integer id (auto), chunk_content, chunk_index');
  }
  console.log();

  // Test 4: Minimal - see what's absolutely required
  console.log('=' .repeat(80));
  console.log('Test 4: Minimal required columns');
  console.log('=' .repeat(80));

  const { error: error4 } = await supabase
    .from('content_chunks')
    .insert({
      entry_id: '61-2tFUCrvNdFWBsTYZMY',
      chunk_index: 0,
    });

  if (error4) {
    console.log('❌ Error:', error4.message);
    console.log('   This tells us what columns are required');
  } else {
    console.log('✅ SUCCESS! Very minimal schema');
  }
  console.log();

  // Query to see what got inserted
  console.log('=' .repeat(80));
  console.log('Querying inserted test chunks');
  console.log('=' .repeat(80));

  const { data: chunks, error: queryError } = await supabase
    .from('content_chunks')
    .select('*')
    .order('id', { ascending: false })
    .limit(5);

  if (queryError) {
    console.log('❌ Query error:', queryError.message);
  } else if (chunks && chunks.length > 0) {
    console.log(`\nFound ${chunks.length} recent chunks:`);
    const latestChunk = chunks[0];
    console.log('\n✨ ACTUAL SCHEMA (from latest chunk):');
    console.log('Columns:', Object.keys(latestChunk).sort().join(', '));
    console.log('\nFull structure:');
    console.log(JSON.stringify(latestChunk, null, 2));
  } else {
    console.log('⚠️  No chunks found');
  }
  console.log();

  // Cleanup test chunks
  console.log('=' .repeat(80));
  console.log('Cleanup');
  console.log('=' .repeat(80));

  if (chunks && chunks.length > 0) {
    // Get IDs of test chunks (those with metadata.test === true)
    const testChunkIds = chunks
      .filter((c: any) => c.metadata?.test === true)
      .map((c: any) => c.id);

    if (testChunkIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('content_chunks')
        .delete()
        .in('id', testChunkIds);

      if (deleteError) {
        console.log('⚠️  Cleanup error:', deleteError.message);
      } else {
        console.log(`✅ Removed ${testChunkIds.length} test chunks`);
      }
    }
  }
}

discoverChunksSchema().catch(console.error);
