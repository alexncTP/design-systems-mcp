#!/usr/bin/env tsx
/**
 * Check ingestion status
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

async function checkIngestion() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Count entries
  const { count: entryCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });
  
  // Count entries with embeddings
  const { count: embeddingCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true })
    .not('embedding', 'is', null);
  
  // Count chunks
  const { count: chunkCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });
  
  console.log('📊 Ingestion Status:');
  console.log(`   Total entries: ${entryCount || 0}`);
  console.log(`   Entries with embeddings: ${embeddingCount || 0}`);
  console.log(`   Total chunks: ${chunkCount || 0}`);
  
  if (entryCount && entryCount > 0) {
    // Get a sample entry
    const { data: sample } = await supabase
      .from('content_entries')
      .select('id, title, category, tags')
      .limit(3);
    
    console.log('\n📚 Sample entries:');
    sample?.forEach(entry => {
      console.log(`   - ${entry.title} (${entry.category})`);
    });
  }
}

checkIngestion().catch(console.error);