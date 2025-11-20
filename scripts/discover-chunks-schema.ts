/**
 * Discover content_chunks schema by attempting inserts
 * This reveals actual production schema through error messages
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function discoverChunksSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Discovering content_chunks Schema\n');
  console.log('Strategy: Attempt minimal insert to reveal actual columns\n');

  // Test 1: Try with expected schema from migration
  console.log('=' .repeat(80));
  console.log('Test 1: Migration schema (text, embedding, chunk_index, start_index, end_index)');
  console.log('=' .repeat(80));

  const testChunk1 = {
    id: 'test-chunk-001',
    entry_id: '61-2tFUCrvNdFWBsTYZMY', // Use existing entry
    text: 'Test chunk content',
    embedding: new Array(1536).fill(0), // Dummy embedding
    chunk_index: 0,
    start_index: 0,
    end_index: 18,
    metadata: { test: true },
  };

  const { error: error1 } = await supabase
    .from('content_chunks')
    .insert(testChunk1);

  if (error1) {
    console.log('❌ Error:', error1.message);
    console.log('   Details:', error1.details);
    console.log('   Hint:', error1.hint);
  } else {
    console.log('✅ SUCCESS! This schema works.');
  }
  console.log();

  // Test 2: Try without start_index/end_index (maybe they don't exist)
  console.log('=' .repeat(80));
  console.log('Test 2: Without start_index/end_index');
  console.log('=' .repeat(80));

  const testChunk2 = {
    id: 'test-chunk-002',
    entry_id: '61-2tFUCrvNdFWBsTYZMY',
    text: 'Test chunk content',
    embedding: new Array(1536).fill(0),
    chunk_index: 0,
    metadata: { test: true },
  };

  const { error: error2 } = await supabase
    .from('content_chunks')
    .insert(testChunk2);

  if (error2) {
    console.log('❌ Error:', error2.message);
  } else {
    console.log('✅ SUCCESS! Schema works without start_index/end_index');
  }
  console.log();

  // Test 3: Try with chunk_text instead of text
  console.log('=' .repeat(80));
  console.log('Test 3: chunk_text instead of text');
  console.log('=' .repeat(80));

  const testChunk3 = {
    id: 'test-chunk-003',
    entry_id: '61-2tFUCrvNdFWBsTYZMY',
    chunk_text: 'Test chunk content', // Different column name
    embedding: new Array(1536).fill(0),
    chunk_index: 0,
    metadata: { test: true },
  };

  const { error: error3 } = await supabase
    .from('content_chunks')
    .insert(testChunk3);

  if (error3) {
    console.log('❌ Error:', error3.message);
  } else {
    console.log('✅ SUCCESS! Schema uses chunk_text column');
  }
  console.log();

  // Test 4: Minimal required columns only
  console.log('=' .repeat(80));
  console.log('Test 4: Minimal columns (id, entry_id, text, chunk_index)');
  console.log('=' .repeat(80));

  const testChunk4 = {
    id: 'test-chunk-004',
    entry_id: '61-2tFUCrvNdFWBsTYZMY',
    text: 'Test chunk content',
    chunk_index: 0,
  };

  const { error: error4 } = await supabase
    .from('content_chunks')
    .insert(testChunk4);

  if (error4) {
    console.log('❌ Error:', error4.message);
  } else {
    console.log('✅ SUCCESS! Minimal schema works (embedding optional)');
  }
  console.log();

  // Query actual chunks to see what got inserted
  console.log('=' .repeat(80));
  console.log('Actual chunks in database:');
  console.log('=' .repeat(80));

  const { data: chunks, error: queryError } = await supabase
    .from('content_chunks')
    .select('*')
    .like('id', 'test-chunk-%');

  if (queryError) {
    console.log('❌ Query error:', queryError.message);
  } else if (chunks && chunks.length > 0) {
    console.log(`\n Found ${chunks.length} test chunks:`);
    chunks.forEach(chunk => {
      console.log('\nChunk columns:', Object.keys(chunk).sort().join(', '));
      console.log('Sample:', JSON.stringify(chunk, null, 2).substring(0, 500));
    });
  } else {
    console.log('⚠️  No test chunks found - all inserts failed');
  }
  console.log();

  // Cleanup
  console.log('=' .repeat(80));
  console.log('Cleanup: Removing test chunks');
  console.log('=' .repeat(80));

  const { error: deleteError } = await supabase
    .from('content_chunks')
    .delete()
    .like('id', 'test-chunk-%');

  if (deleteError) {
    console.log('⚠️  Cleanup error:', deleteError.message);
  } else {
    console.log('✅ Test chunks removed');
  }
  console.log();

  console.log('=' .repeat(80));
  console.log('CONCLUSION');
  console.log('=' .repeat(80));
  console.log();
  console.log('Review the test results above to determine the actual schema.');
  console.log('The successful test shows which columns exist in production.');
}

discoverChunksSchema().catch(console.error);
