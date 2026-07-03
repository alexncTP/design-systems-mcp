/**
 * Database Sync Pull Tool
 * Downloads data from production Supabase to local instance
 * Supports incremental sync and dry-run mode for safety
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

interface SyncOptions {
  dryRun: boolean;
  incremental: boolean;
  backup: boolean;
  verbose: boolean;
}

interface SyncResult {
  entriesDownloaded: number;
  chunksDownloaded: number;
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

async function getLocalEntryIds(localClient: any): Promise<Set<string>> {
  const { data, error } = await localClient
    .from('content_entries')
    .select('id');

  if (error) {
    throw new Error(`Failed to fetch local entry IDs: ${error.message}`);
  }

  return new Set((data || []).map((e: any) => e.id));
}

async function downloadEntries(
  productionClient: any,
  localClient: any,
  options: SyncOptions
): Promise<SyncResult> {
  const result: SyncResult = {
    entriesDownloaded: 0,
    chunksDownloaded: 0,
    entriesSkipped: 0,
    errors: [],
    dryRun: options.dryRun,
  };

  console.log('\n📥 Downloading entries from production...');

  // Get existing local entry IDs for incremental sync
  const localEntryIds = options.incremental ? await getLocalEntryIds(localClient) : new Set<string>();

  // Fetch all production entries
  const { data: prodEntries, error: fetchError } = await productionClient
    .from('content_entries')
    .select('*')
    .order('ingested_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch production entries: ${fetchError.message}`);
  }

  console.log(`   Found ${prodEntries.length} entries in production`);

  if (options.incremental) {
    console.log(`   Local has ${localEntryIds.size} existing entries`);
  }

  // Process each entry
  for (const entry of prodEntries) {
    try {
      // Skip if already exists locally (incremental mode)
      if (options.incremental && localEntryIds.has(entry.id)) {
        result.entriesSkipped++;
        if (options.verbose) {
          console.log(`   ⏭️  Skipped: ${entry.title} (already exists locally)`);
        }
        continue;
      }

      if (options.dryRun) {
        console.log(`   [DRY RUN] Would download: ${entry.title}`);
        result.entriesDownloaded++;
        continue;
      }

      // Download entry
      const { error: insertError } = await localClient
        .from('content_entries')
        .upsert({
          id: entry.id,
          title: entry.title,
          content: entry.content,
          embedding: entry.embedding,
          source_type: entry.source_type,
          source_location: entry.source_location,
          source_url: entry.source_url,
          metadata: entry.metadata,
          updated_at: entry.updated_at,
          ingested_at: entry.ingested_at,
          deleted_at: entry.deleted_at,
        });

      if (insertError) {
        result.errors.push(`Entry ${entry.id}: ${insertError.message}`);
        console.error(`   ❌ Failed: ${entry.title} - ${insertError.message}`);
        continue;
      }

      // Download associated chunks
      const { data: chunks, error: chunksError } = await productionClient
        .from('content_chunks')
        .select('*')
        .eq('entry_id', entry.id);

      if (chunksError) {
        result.errors.push(`Chunks for ${entry.id}: ${chunksError.message}`);
        console.error(`   ⚠️  Failed to download chunks for ${entry.title}`);
      } else if (chunks && chunks.length > 0) {
        const { error: chunksInsertError } = await localClient
          .from('content_chunks')
          .upsert(chunks);

        if (chunksInsertError) {
          result.errors.push(`Chunks insert for ${entry.id}: ${chunksInsertError.message}`);
        } else {
          result.chunksDownloaded += chunks.length;
        }
      }

      result.entriesDownloaded++;

      if (options.verbose) {
        console.log(`   ✅ Downloaded: ${entry.title} (${chunks?.length || 0} chunks)`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Entry ${entry.id}: ${errorMsg}`);
      console.error(`   ❌ Error: ${entry.title} - ${errorMsg}`);
    }
  }

  return result;
}

async function pullFromProduction(options: SyncOptions): Promise<void> {
  console.log('🔽 Database Sync Pull Tool');
  console.log('=' .repeat(60));

  if (options.dryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to databases
  const productionClient = await getProductionClient();
  const localClient = await getLocalClient();

  // Download entries and chunks
  const result = await downloadEntries(productionClient, localClient, options);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC SUMMARY');
  console.log('='.repeat(60));

  if (result.dryRun) {
    console.log(`\n[DRY RUN] Would download:`);
    console.log(`   Entries: ${result.entriesDownloaded}`);
    console.log(`   Skipped: ${result.entriesSkipped}`);
  } else {
    console.log(`\n✅ Downloaded:`);
    console.log(`   Entries: ${result.entriesDownloaded}`);
    console.log(`   Chunks: ${result.chunksDownloaded}`);
    console.log(`   Skipped: ${result.entriesSkipped}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`   - ${err}`));
  }

  if (!result.dryRun && result.entriesDownloaded > 0) {
    console.log('\n✨ Sync completed successfully!');
    console.log('   Run npm run validate:ingestion to verify data integrity\n');
  } else if (result.dryRun) {
    console.log('\n💡 To execute this sync, run without --dry-run flag\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SyncOptions = {
  dryRun: args.includes('--dry-run'),
  incremental: !args.includes('--full'),
  backup: !args.includes('--no-backup'),
  verbose: args.includes('--verbose') || args.includes('-v'),
};

// Execute sync
pullFromProduction(options)
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
