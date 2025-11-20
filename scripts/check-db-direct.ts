import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkDatabase() {
  console.log('🔍 Checking Supabase database...\n');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('Using key:', process.env.SUPABASE_ANON_KEY?.substring(0, 20) + '...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Check content_entries table
  console.log('📋 Checking content_entries table...');
  const { data: entries, error: entriesError, count: entriesCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  if (entriesError) {
    console.error('❌ Error querying content_entries:', entriesError);
  } else {
    console.log(`✅ content_entries count: ${entriesCount}\n`);
  }

  // Check content_chunks table
  console.log('📋 Checking content_chunks table...');
  const { data: chunks, error: chunksError, count: chunksCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  if (chunksError) {
    console.error('❌ Error querying content_chunks:', chunksError);
  } else {
    console.log(`✅ content_chunks count: ${chunksCount}\n`);
  }

  // Get sample entries if any exist
  if (entriesCount && entriesCount > 0) {
    console.log('📄 Sample entries:');
    const { data: sample } = await supabase
      .from('content_entries')
      .select('id, title')
      .limit(5);

    sample?.forEach((entry, idx) => {
      console.log(`  ${idx + 1}. ${entry.title} (${entry.id})`);
    });
  }
}

checkDatabase();
