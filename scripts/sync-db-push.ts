/**
 * Database Sync Push Tool
 * Uploads data from local Supabase to production instance
 * REQUIRES EXPLICIT CONFIRMATION for production safety
 * Supports incremental sync and dry-run mode
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

interface SyncOptions {
  dryRun: boolean;
  incremental: boolean;
  confirm: boolean;
  validate: boolean;
  verbose: boolean;
}

interface SyncResult {
  entriesUploaded: number;
  chunksUploaded: number;
  entriesSkipped: number;
  errors: string[];
  dryRun: boolean;
}

async function getProductionClient() {
  const prodUrl = process.env.SUPABASE_PROD_URL || process.env.SUPABASE_URL;
  const prodKey = process.env.SUPABASE_PROD_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!prodUrl || !prodKey) {
    throw new Error(
      'Production Supabase credentials not found. Please set SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_KEY in .env'
    );
  }

  return createClient(prodUrl, prodKey);
}

async function getLocalClient() {
  const localUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const localKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!localKey) {
    throw new Error('Local Supabase credentials not found');
  }

  return createClient(localUrl, localKey);
}

async function getProductionEntryIds(productionClient: any): Promise<Set<string>> {
  const { data, error } = await productionClient
    .from('content_entries')
    .select('id');

  if (error) {
    throw new Error(`Failed to fetch production entry IDs: ${error.message}`);
  }

  return new Set((data || []).map((e: any) => e.id));
}

async function validateLocalEntry(entry: any): Promise<{ valid: boolean; reason?: string }> {
  // Validation checks
  if (!entry.id || !entry.title || !entry.content) {
    return { valid: false, reason: 'Missing required fields (id, title, content)' };
  }

  if (!entry.embedding || !Array.isArray(entry.embedding)) {
    return { valid: false, reason: 'Missing or invalid embedding' };
  }

  if (entry.embedding.length !== 1536) {
    return { valid: false, reason: `Invalid embedding dimension: ${entry.embedding.length} (expected 1536)` };
  }

  return { valid: true };
}

async function uploadEntries(
  localClient: any,
  productionClient: any,
  options: SyncOptions
): Promise<SyncResult> {
  const result: SyncResult = {
    entriesUploaded: 0,
    chunksUploaded: 0,
    entriesSkipped: 0,
    errors: [],
    dryRun: options.dryRun,
  };

  console.log('\n📤 Uploading entries to production...');

  // Get existing production entry IDs for incremental sync
  const productionEntryIds = options.incremental
    ? await getProductionEntryIds(productionClient)
    : new Set<string>();

  // Fetch all local entries (schema has ingested_at, not created_at)
  const { data: localEntries, error: fetchError } = await localClient
    .from('content_entries')
    .select('*')
    .order('ingested_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch local entries: ${fetchError.message}`);
  }

  console.log(`   Found ${localEntries.length} entries in local database`);

  if (options.incremental) {
    console.log(`   Production has ${productionEntryIds.size} existing entries`);
  }

  // Process each entry
  for (const entry of localEntries) {
    try {
      // Skip if already exists in production (incremental mode)
      if (options.incremental && productionEntryIds.has(entry.id)) {
        result.entriesSkipped++;
        if (options.verbose) {
          console.log(`   ⏭️  Skipped: ${entry.title} (already exists in production)`);
        }
        continue;
      }

      // Validate entry before upload
      if (options.validate) {
        const validation = await validateLocalEntry(entry);
        if (!validation.valid) {
          result.errors.push(`Entry ${entry.id}: ${validation.reason}`);
          console.error(`   ❌ Validation failed: ${entry.title} - ${validation.reason}`);
          continue;
        }
      }

      if (options.dryRun) {
        console.log(`   [DRY RUN] Would upload: ${entry.title}`);
        result.entriesUploaded++;
        continue;
      }

      // Upload entry (columns match the live content_entries schema)
      const { error: insertError } = await productionClient
        .from('content_entries')
        .upsert({
          id: entry.id,
          title: entry.title,
          content: entry.content,
          embedding: entry.embedding,
          source_type: entry.source_type,
          source_location: entry.source_location,
          category: entry.category,
          system_name: entry.system_name,
          tags: entry.tags,
          confidence: entry.confidence,
          metadata: entry.metadata,
          updated_at: entry.updated_at,
          ingested_at: entry.ingested_at,
        });

      if (insertError) {
        result.errors.push(`Entry ${entry.id}: ${insertError.message}`);
        console.error(`   ❌ Failed: ${entry.title} - ${insertError.message}`);
        continue;
      }

      // Upload associated chunks
      const { data: chunks, error: chunksError } = await localClient
        .from('content_chunks')
        .select('*')
        .eq('entry_id', entry.id);

      if (chunksError) {
        result.errors.push(`Chunks for ${entry.id}: ${chunksError.message}`);
        console.error(`   ⚠️  Failed to fetch chunks for ${entry.title}`);
      } else if (chunks && chunks.length > 0) {
        const { error: chunksInsertError } = await productionClient
          .from('content_chunks')
          .upsert(chunks);

        if (chunksInsertError) {
          result.errors.push(`Chunks upload for ${entry.id}: ${chunksInsertError.message}`);
        } else {
          result.chunksUploaded += chunks.length;
        }
      }

      result.entriesUploaded++;

      if (options.verbose) {
        console.log(`   ✅ Uploaded: ${entry.title} (${chunks?.length || 0} chunks)`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Entry ${entry.id}: ${errorMsg}`);
      console.error(`   ❌ Error: ${entry.title} - ${errorMsg}`);
    }
  }

  return result;
}

async function pushToProduction(options: SyncOptions): Promise<void> {
  console.log('🔼 Database Sync Push Tool');
  console.log('=' .repeat(60));

  // Safety checks
  if (!options.confirm && !options.dryRun) {
    console.log('\n⚠️  PRODUCTION PUSH REQUIRES CONFIRMATION');
    console.log('This will upload local data to production Supabase.');
    console.log('\nTo proceed, add --confirm flag:');
    console.log('  tsx scripts/sync-db-push.ts --confirm\n');
    console.log('Or run in dry-run mode first:');
    console.log('  tsx scripts/sync-db-push.ts --dry-run\n');
    process.exit(0);
  }

  if (options.dryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  PRODUCTION MODE - Changes will be written to production\n');
  }

  // Connect to databases
  const localClient = await getLocalClient();
  const productionClient = await getProductionClient();

  // Upload entries and chunks
  const result = await uploadEntries(localClient, productionClient, options);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));

  if (result.dryRun) {
    console.log(`\n[DRY RUN] Would upload:`);
    console.log(`   Entries: ${result.entriesUploaded}`);
    console.log(`   Skipped: ${result.entriesSkipped}`);
  } else {
    console.log(`\n✅ Uploaded:`);
    console.log(`   Entries: ${result.entriesUploaded}`);
    console.log(`   Chunks: ${result.chunksUploaded}`);
    console.log(`   Skipped: ${result.entriesSkipped}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`   - ${err}`));
  }

  if (!result.dryRun && result.entriesUploaded > 0) {
    console.log('\n✨ Sync completed successfully!');
    console.log('   Production database has been updated\n');
  } else if (result.dryRun) {
    console.log('\n💡 To execute this sync, run:');
    console.log('   tsx scripts/sync-db-push.ts --confirm\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SyncOptions = {
  dryRun: args.includes('--dry-run'),
  incremental: !args.includes('--full'),
  confirm: args.includes('--confirm'),
  validate: !args.includes('--no-validate'),
  verbose: args.includes('--verbose') || args.includes('-v'),
};

// Execute sync
pushToProduction(options)
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
