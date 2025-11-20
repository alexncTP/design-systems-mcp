import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkThemingContent() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Check various theming-related terms
  const terms = ['theme', 'theming', 'styling', 'customization', 'dark mode', 'light mode', 'color scheme', 'brand'];

  for (const term of terms) {
    console.log(`\n🔍 Searching for "${term}"...\n`);

    const { data, error } = await supabase
      .from('content_entries')
      .select('id, title, metadata')
      .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
      .limit(5);

    if (error) {
      console.error('Error:', error);
      continue;
    }

    if (data.length > 0) {
      console.log(`✅ Found ${data.length} entries:`);
      data.forEach((entry, i) => {
        console.log(`  ${i + 1}. ${entry.title} (${entry.metadata?.category || 'N/A'})`);
      });
    } else {
      console.log(`❌ No entries found for "${term}"`);
    }
  }

  // Get sample of all content to understand what we have
  console.log('\n\n📋 Sample of ALL content in database:\n');
  const { data: sample, error: sampleError } = await supabase
    .from('content_entries')
    .select('id, title, metadata')
    .limit(20);

  if (!sampleError && sample) {
    sample.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.title} (${entry.metadata?.category || 'N/A'})`);
    });

    // Count total
    const { count } = await supabase
      .from('content_entries')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total entries in database: ${count}`);
  }
}

checkThemingContent();
