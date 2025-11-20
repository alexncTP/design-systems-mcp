import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkDatabase() {
  console.log('🔍 Checking Supabase database WITH SERVICE KEY...\n');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('Using SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY?.substring(0, 20) + '...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!  // Use SERVICE_KEY to bypass RLS
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
    console.log('📄 Sample entries (first 5):');
    const { data: sample } = await supabase
      .from('content_entries')
      .select('id, title, source_type')
      .limit(5);

    sample?.forEach((entry, idx) => {
      console.log(`  ${idx + 1}. ${entry.title}`);
      console.log(`     ID: ${entry.id}, Type: ${entry.source_type}`);
    });
    console.log();
  }

  // Search for theming content specifically
  if (entriesCount && entriesCount > 0) {
    console.log('🔍 Searching for "theming" related content...');
    const { data: themingResults, count: themingCount } = await supabase
      .from('content_entries')
      .select('id, title', { count: 'exact' })
      .or('title.ilike.%theme%,title.ilike.%theming%,content.ilike.%theme%');

    console.log(`Found ${themingCount} entries related to theming\n`);

    if (themingResults && themingResults.length > 0) {
      console.log('Sample theming-related entries:');
      themingResults.slice(0, 3).forEach((entry, idx) => {
        console.log(`  ${idx + 1}. ${entry.title} (${entry.id})`);
      });
    }
  }
}

checkDatabase();
