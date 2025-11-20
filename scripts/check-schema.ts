import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkSchema() {
  console.log('🔍 Checking Supabase schema...\n');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Try to describe the tables
  console.log('📋 Checking if tables exist...\n');

  // Check content_entries structure
  console.log('1. content_entries table:');
  const { data: entries, error: entriesError } = await supabase
    .from('content_entries')
    .select('*')
    .limit(0);

  if (entriesError) {
    console.error('   ❌ Error:', entriesError.message);
    console.error('   Code:', entriesError.code);
    console.error('   Details:', entriesError.details);
  } else {
    console.log('   ✅ Table exists and is accessible\n');
  }

  // Check content_chunks structure
  console.log('2. content_chunks table:');
  const { data: chunks, error: chunksError } = await supabase
    .from('content_chunks')
    .select('*')
    .limit(0);

  if (chunksError) {
    console.error('   ❌ Error:', chunksError.message);
    console.error('   Code:', chunksError.code);
    console.error('   Details:', chunksError.details);
  } else {
    console.log('   ✅ Table exists and is accessible\n');
  }

  // Test write permission
  console.log('3. Testing write permissions...');
  const testEntry = {
    id: 'test-' + Date.now(),
    title: 'Test Entry',
    content: 'Test content',
    embedding: new Array(1536).fill(0),
    source_type: 'test',
    source_location: 'test',
    metadata: {},
    ingested_at: new Date().toISOString()
  };

  const { error: writeError } = await supabase
    .from('content_entries')
    .insert(testEntry);

  if (writeError) {
    console.error('   ❌ Write failed:', writeError.message);
    console.error('   Code:', writeError.code);
    console.error('   Details:', writeError.details);
  } else {
    console.log('   ✅ Write permission works!');

    // Clean up test entry
    await supabase
      .from('content_entries')
      .delete()
      .eq('id', testEntry.id);
    console.log('   ✅ Test entry cleaned up\n');
  }
}

checkSchema();
