/**
 * Check Production content_chunks Schema
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function checkSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl!, supabaseKey!);

  console.log('📊 Checking production content_chunks schema...\n');

  const { data: chunks, error } = await supabase
    .from('content_chunks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (chunks && chunks.length > 0) {
    console.log('Available columns in content_chunks:');
    console.log(Object.keys(chunks[0]).sort());
    console.log('\nSample chunk:');
    console.log(JSON.stringify(chunks[0], null, 2));
  }
}

checkSchema();
