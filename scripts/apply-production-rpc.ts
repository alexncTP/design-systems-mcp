/**
 * Apply Production RPC Functions
 * Creates the missing RPC functions that match production schema
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

async function applyProductionRpc() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  console.log('🚀 Applying Production RPC Functions\n');
  console.log('=' .repeat(80));

  try {
    // Read the SQL migration file
    const sqlPath = join(__dirname, '../supabase/migrations/20250118_production_rpc_functions.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Loaded migration file');
    console.log('   File: 20250118_production_rpc_functions.sql');
    console.log('   Size:', sql.length, 'bytes\n');

    // Split into individual statements (basic split on $$;)
    const statements = sql
      .split('$$;')
      .filter(stmt => {
        const trimmed = stmt.trim();
        return trimmed.length > 0 &&
               !trimmed.startsWith('--') &&
               trimmed !== '$$';
      })
      .map(stmt => stmt + '$$;');

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    const failCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      // Extract function name for logging
      const funcMatch = stmt.match(/FUNCTION\s+(\w+)/i);
      const funcName = funcMatch ? funcMatch[1] : `statement ${i + 1}`;

      try {
        console.log(`⚙️  Executing: ${funcName}...`);

        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });

        if (error) {
          // Try alternative: direct query (might not work with Supabase API)
          console.log('   ℹ️  exec_sql not available, note: Run this SQL manually in Supabase SQL Editor');
          console.log(`   Statement: ${funcName}`);
        } else {
          console.log(`   ✅ Success: ${funcName}`);
          successCount++;
        }
      } catch (error: any) {
        console.log(`   ⚠️  Note: ${funcName} - ${error.message}`);
        console.log('   This is expected - Supabase API doesn\'t support CREATE FUNCTION via JS');
        console.log('   You need to run the SQL in the Supabase SQL Editor');
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('\n📝 INSTRUCTIONS:');
    console.log('   1. Open Supabase Dashboard → SQL Editor');
    console.log('   2. Paste contents of:');
    console.log('      supabase/migrations/20250118_production_rpc_functions.sql');
    console.log('   3. Click "Run" to create all RPC functions');
    console.log('   4. Verify with: SELECT * FROM check_vector_search_setup();\n');

    console.log('✨ After applying the SQL, run:');
    console.log('   npm run demo:vectors\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

applyProductionRpc();
