/**
 * Check Production Database Schema
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function checkSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl!, supabaseKey!);

  console.log('📊 Checking production schema...\n');

  // Get one entry to see its structure
  const { data: entries, error } = await supabase
    .from('content_entries')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (entries && entries.length > 0) {
    console.log('Available columns in content_entries:');
    console.log(Object.keys(entries[0]).sort());
    console.log('\nSample entry:');
    console.log(JSON.stringify(entries[0], null, 2));
  }
}

checkSchema();
