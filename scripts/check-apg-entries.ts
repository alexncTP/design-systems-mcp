#!/usr/bin/env tsx
/**
 * Check APG entries in Supabase
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

async function checkAPG() {
  const { data, error } = await supabase
    .from('content_entries')
    .select('id, title, content, source_location, metadata')
    .or('source_location.ilike.%apg%,title.ilike.%ARIA%')
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Found', data?.length || 0, 'APG-related entries in Supabase:\n');
  data?.forEach((entry, i) => {
    console.log(`${i+1}. ${entry.title}`);
    console.log(`   ID: ${entry.id}`);
    console.log(`   Source: ${entry.source_location}`);
    const hasCaveats = entry.content?.includes('IMPORTANT:') || false;
    const hasReliability = entry.metadata?.reliability ? true : false;
    console.log(`   Has caveats in content: ${hasCaveats}`);
    console.log(`   Has reliability metadata: ${hasReliability}`);
    console.log(`   Content preview: ${entry.content?.substring(0, 200)}...`);
    console.log();
  });
}

checkAPG();
