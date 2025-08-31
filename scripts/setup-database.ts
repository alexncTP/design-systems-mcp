#!/usr/bin/env tsx
/**
 * Script to set up Supabase database schema
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database schema...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env');
    process.exit(1);
  }

  console.log('📋 Database Setup Instructions:\n');
  console.log('Since we cannot execute raw SQL directly from the client,');
  console.log('please follow these steps to set up your database:\n');
  
  console.log('1. Go to your Supabase project dashboard');
  console.log(`   ${supabaseUrl}\n`);
  
  console.log('2. Navigate to SQL Editor (left sidebar)\n');
  
  console.log('3. Create a new query and paste the following SQL:\n');
  console.log('─'.repeat(60));
  
  // Read and display the schema file
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Show first part of schema
  const lines = schemaContent.split('\n');
  const preview = lines.slice(0, 30).join('\n');
  console.log(preview);
  console.log('... (truncated for display)');
  console.log('─'.repeat(60));
  
  console.log('\n4. Click "Run" to execute the SQL\n');
  
  console.log('The full schema file is located at:');
  console.log(`   ${schemaPath}\n`);
  
  // Try to connect and check if tables exist
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 Checking current database status...\n');
  
  try {
    // Check if vector extension exists
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .single();
    
    if (extensions) {
      console.log('✅ pgvector extension is installed');
    } else {
      console.log('⚠️  pgvector extension not found - please run: CREATE EXTENSION IF NOT EXISTS vector;');
    }
  } catch (error) {
    console.log('⚠️  Could not check pgvector extension status');
  }
  
  try {
    // Check if content_entries table exists
    const { error: tableError } = await supabase
      .from('content_entries')
      .select('id')
      .limit(1);
    
    if (!tableError) {
      console.log('✅ content_entries table exists');
      
      // Count existing entries
      const { count } = await supabase
        .from('content_entries')
        .select('*', { count: 'exact', head: true });
      
      if (count && count > 0) {
        console.log(`📊 Found ${count} existing entries in database`);
        console.log('\n⚠️  Warning: Running ingestion with --clear will delete existing data');
      } else {
        console.log('📭 Table is empty - ready for ingestion');
      }
    } else {
      console.log('❌ content_entries table not found - please run the schema SQL');
    }
  } catch (error) {
    console.log('❌ Could not connect to database - please check credentials');
  }
  
  try {
    // Check if content_chunks table exists
    const { error: chunksError } = await supabase
      .from('content_chunks')
      .select('id')
      .limit(1);
    
    if (!chunksError) {
      console.log('✅ content_chunks table exists');
    } else {
      console.log('❌ content_chunks table not found - please run the schema SQL');
    }
  } catch (error) {
    // Table doesn't exist
  }
  
  console.log('\n📝 Next Steps:');
  console.log('1. Run the schema SQL in Supabase SQL Editor');
  console.log('2. Run: npm run ingest:vectors -- --verbose');
  console.log('3. Test: npm run test:vector');
  
  console.log('\n💡 Tip: You can also use the Supabase CLI:');
  console.log('   npx supabase db push --db-url "postgresql://postgres:[password]@[project].supabase.co:5432/postgres" < database/schema.sql');
}

setupDatabase().catch(console.error);