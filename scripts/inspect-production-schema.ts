/**
 * Production Schema Inspector
 *
 * Queries production database to show:
 * 1. Actual columns in content_entries and content_chunks
 * 2. Column types, nullable status, defaults
 * 3. Indexes on both tables
 * 4. Comparison with expected schema
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

async function inspectSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Production Schema Inspector\n');
  console.log('=' .repeat(80));
  console.log('📊 Database:', supabaseUrl);
  console.log('=' .repeat(80));
  console.log();

  // Query 1: Check if tables exist
  console.log('📋 Step 1: Checking if tables exist...\n');

  // Try to get tables via a simple select
  const { error: entriesError } = await supabase
    .from('content_entries')
    .select('id', { count: 'exact', head: true })
    .limit(0);

  const { error: chunksError } = await supabase
    .from('content_chunks')
    .select('id', { count: 'exact', head: true })
    .limit(0);

  console.log('✅ content_entries exists:', !entriesError ? 'YES' : 'NO');
  console.log('✅ content_chunks exists:', !chunksError ? 'YES' : 'NO');
  console.log();

  // Query 2: INFORMATION_SCHEMA for content_entries (definitive DDL)
  console.log('=' .repeat(80));
  console.log('🔍 INFORMATION_SCHEMA: content_entries');
  console.log('=' .repeat(80));
  console.log();

  const { data: entriesSchema, error: entriesSchemaError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'content_entries'
      ORDER BY ordinal_position;
    `
  });

  if (entriesSchemaError) {
    console.log('⚠️  Could not query information_schema (may need to use direct SQL)');
    console.log('   Error:', entriesSchemaError.message);
  } else if (entriesSchema) {
    console.log('Columns from information_schema:');
    console.log();
    (entriesSchema as ColumnInfo[]).forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${(idx + 1).toString().padStart(2)}. ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}${defaultVal}`);
    });
  }
  console.log();

  // Query 3: INFORMATION_SCHEMA for content_chunks (definitive DDL)
  console.log('=' .repeat(80));
  console.log('🔍 INFORMATION_SCHEMA: content_chunks');
  console.log('=' .repeat(80));
  console.log();

  const { data: chunksSchema, error: chunksSchemaError } = await supabase.rpc('execute_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'content_chunks'
      ORDER BY ordinal_position;
    `
  });

  if (chunksSchemaError) {
    console.log('⚠️  Could not query information_schema (may need to use direct SQL)');
    console.log('   Error:', chunksSchemaError.message);
  } else if (chunksSchema) {
    console.log('Columns from information_schema:');
    console.log();
    (chunksSchema as ColumnInfo[]).forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`${(idx + 1).toString().padStart(2)}. ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} ${nullable}${defaultVal}`);
    });
  }
  console.log();

  // Query 4: Get columns for content_entries from data
  console.log('=' .repeat(80));
  console.log('📊 CONTENT_ENTRIES TABLE SCHEMA');
  console.log('=' .repeat(80));
  console.log();

  const { data: entriesColumns } = await supabase
    .from('content_entries')
    .select('*')
    .limit(1);

  if (entriesColumns && entriesColumns.length > 0) {
    const columns = Object.keys(entriesColumns[0]).sort();
    console.log('Available columns:', columns.length);
    console.log();

    columns.forEach((col, idx) => {
      const value = entriesColumns[0][col];
      const type = value === null ? 'null' : typeof value;
      const sample = type === 'string' && value ?
        `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
        type === 'object' && value ?
        JSON.stringify(value).substring(0, 50) + '...' :
        String(value);

      console.log(`${(idx + 1).toString().padStart(2)}. ${col.padEnd(20)} [${type}]`);
    });
  } else {
    console.log('⚠️  No data in content_entries, checking schema another way...');
  }
  console.log();

  // Query 3: Get columns for content_chunks
  console.log('=' .repeat(80));
  console.log('📊 CONTENT_CHUNKS TABLE SCHEMA');
  console.log('=' .repeat(80));
  console.log();

  const { data: chunksColumns } = await supabase
    .from('content_chunks')
    .select('*')
    .limit(1);

  if (chunksColumns && chunksColumns.length > 0) {
    const columns = Object.keys(chunksColumns[0]).sort();
    console.log('Available columns:', columns.length);
    console.log();

    columns.forEach((col, idx) => {
      const value = chunksColumns[0][col];
      const type = value === null ? 'null' : typeof value;

      console.log(`${(idx + 1).toString().padStart(2)}. ${col.padEnd(20)} [${type}]`);
    });
  } else {
    console.log('⚠️  No data in content_chunks');
    console.log('This might be normal - table might be empty');
  }
  console.log();

  // Query 4: Expected schema from migration
  console.log('=' .repeat(80));
  console.log('📋 EXPECTED SCHEMA (from migration file)');
  console.log('=' .repeat(80));
  console.log();

  console.log('content_entries expected columns:');
  const expectedEntries = [
    'id (TEXT PRIMARY KEY)',
    'title (TEXT NOT NULL)',
    'content (TEXT NOT NULL)',
    'embedding (vector(1536))',
    'source_type (TEXT)',
    'source_location (TEXT)',
    'source_url (TEXT)',
    'metadata (JSONB)',
    'created_at (TIMESTAMPTZ)',
    'updated_at (TIMESTAMPTZ)',
    'ingested_at (TIMESTAMPTZ)',
    'deleted_at (TIMESTAMPTZ)',
  ];
  expectedEntries.forEach((col, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${col}`);
  });
  console.log();

  console.log('content_chunks expected columns:');
  const expectedChunks = [
    'id (TEXT PRIMARY KEY)',
    'entry_id (TEXT REFERENCES content_entries)',
    'text (TEXT NOT NULL)',
    'embedding (vector(1536))',
    'chunk_index (INTEGER NOT NULL)',
    'start_index (INTEGER)',
    'end_index (INTEGER)',
    'metadata (JSONB)',
    'created_at (TIMESTAMPTZ)',
  ];
  expectedChunks.forEach((col, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${col}`);
  });
  console.log();

  // Query 5: Count existing data
  console.log('=' .repeat(80));
  console.log('📊 DATA COUNTS');
  console.log('=' .repeat(80));
  console.log();

  const { count: entriesCount } = await supabase
    .from('content_entries')
    .select('*', { count: 'exact', head: true });

  const { count: chunksCount } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`content_entries: ${entriesCount} rows`);
  console.log(`content_chunks: ${chunksCount} rows`);
  console.log();

  // Query 6: Sample data structure
  console.log('=' .repeat(80));
  console.log('📋 SAMPLE DATA STRUCTURE');
  console.log('=' .repeat(80));
  console.log();

  if (entriesColumns && entriesColumns.length > 0) {
    console.log('Sample content_entries row:');
    const sample = { ...entriesColumns[0] };
    // Truncate long fields
    if (sample.content) sample.content = sample.content.substring(0, 100) + '...';
    if (sample.embedding) sample.embedding = `[${sample.embedding.length} dimensions]`;
    console.log(JSON.stringify(sample, null, 2));
  }
  console.log();

  // Summary
  console.log('=' .repeat(80));
  console.log('📊 SUMMARY & RECOMMENDATIONS');
  console.log('=' .repeat(80));
  console.log();

  if (entriesColumns && entriesColumns.length > 0) {
    const actualCols = Object.keys(entriesColumns[0]).sort();
    const expectedCols = ['id', 'title', 'content', 'embedding', 'source_type',
                          'source_location', 'source_url', 'metadata', 'created_at',
                          'updated_at', 'ingested_at', 'deleted_at'].sort();

    const missing = expectedCols.filter(col => !actualCols.includes(col));
    const extra = actualCols.filter(col => !expectedCols.includes(col));

    if (missing.length > 0) {
      console.log('⚠️  content_entries MISSING columns:', missing.join(', '));
    }
    if (extra.length > 0) {
      console.log('ℹ️  content_entries EXTRA columns:', extra.join(', '));
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log('✅ content_entries schema matches migration!');
    }
  }
  console.log();

  if (!chunksColumns || chunksColumns.length === 0) {
    console.log('⚠️  content_chunks is EMPTY - cannot verify schema from data');
    console.log('💡 Recommendation: Create a test chunk to see actual schema');
  }
  console.log();

  console.log('Next steps:');
  console.log('1. If schema is wrong: Run migration to fix it');
  console.log('2. If schema is correct: Update our code to match');
  console.log('3. Re-import all 104 cleaned entries with correct schema');
  console.log();
}

inspectSchema().catch(console.error);
