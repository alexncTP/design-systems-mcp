/**
 * Database Sync Comparison Tool
 * Compares local and production Supabase instances to identify differences
 * Run this before syncing to understand what will change
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

interface DatabaseStats {
  totalEntries: number;
  totalChunks: number;
  entriesWithEmbeddings: number;
  chunksWithEmbeddings: number;
  entryIds: Set<string>;
  oldestEntry?: string;
  newestEntry?: string;
}

interface ComparisonReport {
  local: DatabaseStats;
  production: DatabaseStats;
  onlyInProduction: string[];
  onlyInLocal: string[];
  inBoth: string[];
  recommendation: string;
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
    throw new Error('Local Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  }

  return createClient(localUrl, localKey);
}

async function getDatabaseStats(supabase: any, name: string): Promise<DatabaseStats> {
  console.log(`\n📊 Analyzing ${name} database...`);

  // Get entries
  const { data: entries, error: entriesError } = await supabase
    .from('content_entries')
    .select('id, ingested_at, embedding')
    .order('ingested_at', { ascending: true });

  if (entriesError) {
    throw new Error(`Failed to fetch entries from ${name}: ${entriesError.message}`);
  }

  // Get chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('content_chunks')
    .select('id, embedding');

  if (chunksError) {
    throw new Error(`Failed to fetch chunks from ${name}: ${chunksError.message}`);
  }

  const entryIds = new Set<string>(entries.map((e: any) => e.id));
  const entriesWithEmbeddings = entries.filter((e: any) => e.embedding).length;
  const chunksWithEmbeddings = chunks?.filter((c: any) => c.embedding).length || 0;

  return {
    totalEntries: entries.length,
    totalChunks: chunks?.length || 0,
    entriesWithEmbeddings,
    chunksWithEmbeddings,
    entryIds,
    oldestEntry: entries[0]?.ingested_at,
    newestEntry: entries[entries.length - 1]?.ingested_at,
  };
}

function generateRecommendation(local: DatabaseStats, production: DatabaseStats): string {
  const onlyInProdCount = production.totalEntries - local.totalEntries;
  const onlyInLocalCount = local.totalEntries - production.totalEntries;

  if (local.totalEntries === 0 && production.totalEntries > 0) {
    return `🔽 PULL RECOMMENDED: Production has ${production.totalEntries} entries, local is empty. Run sync-db-pull.ts to download production data.`;
  }

  if (production.totalEntries === 0 && local.totalEntries > 0) {
    return `🔼 PUSH RECOMMENDED: Local has ${local.totalEntries} entries, production is empty. Run sync-db-push.ts to upload local data.`;
  }

  if (onlyInProdCount > 0 && onlyInLocalCount === 0) {
    return `🔽 PULL RECOMMENDED: Production has ${onlyInProdCount} additional entries not in local. Run sync-db-pull.ts to download missing entries.`;
  }

  if (onlyInLocalCount > 0 && onlyInProdCount === 0) {
    return `🔼 PUSH RECOMMENDED: Local has ${onlyInLocalCount} new entries not in production. Run sync-db-push.ts to upload new entries.`;
  }

  if (onlyInProdCount > 0 && onlyInLocalCount > 0) {
    return `⚠️ DIVERGED: Databases have different content. Production has ${onlyInProdCount} unique entries, local has ${onlyInLocalCount} unique entries. Manual reconciliation may be needed.`;
  }

  return `✅ IN SYNC: Both databases have the same content (${local.totalEntries} entries).`;
}

async function compareDatabases(): Promise<ComparisonReport> {
  console.log('🔍 Database Sync Comparison Tool');
  console.log('=' .repeat(60));

  // Connect to both databases
  const localClient = await getLocalClient();
  const productionClient = await getProductionClient();

  // Get stats from both
  const localStats = await getDatabaseStats(localClient, 'LOCAL');
  const productionStats = await getDatabaseStats(productionClient, 'PRODUCTION');

  // Compare entry IDs
  const onlyInProduction = [...productionStats.entryIds].filter(id => !localStats.entryIds.has(id));
  const onlyInLocal = [...localStats.entryIds].filter(id => !productionStats.entryIds.has(id));
  const inBoth = [...localStats.entryIds].filter(id => productionStats.entryIds.has(id));

  const recommendation = generateRecommendation(localStats, productionStats);

  return {
    local: localStats,
    production: productionStats,
    onlyInProduction,
    onlyInLocal,
    inBoth,
    recommendation,
  };
}

function printReport(report: ComparisonReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPARISON REPORT');
  console.log('='.repeat(60));

  console.log('\n🏠 LOCAL DATABASE:');
  console.log(`   Entries: ${report.local.totalEntries} (${report.local.entriesWithEmbeddings} with embeddings)`);
  console.log(`   Chunks: ${report.local.totalChunks} (${report.local.chunksWithEmbeddings} with embeddings)`);
  if (report.local.oldestEntry) {
    console.log(`   Date Range: ${report.local.oldestEntry} → ${report.local.newestEntry}`);
  }

  console.log('\n☁️  PRODUCTION DATABASE:');
  console.log(`   Entries: ${report.production.totalEntries} (${report.production.entriesWithEmbeddings} with embeddings)`);
  console.log(`   Chunks: ${report.production.totalChunks} (${report.production.chunksWithEmbeddings} with embeddings)`);
  if (report.production.oldestEntry) {
    console.log(`   Date Range: ${report.production.oldestEntry} → ${report.production.newestEntry}`);
  }

  console.log('\n🔄 DIFFERENCES:');
  console.log(`   In both databases: ${report.inBoth.length} entries`);
  console.log(`   Only in production: ${report.onlyInProduction.length} entries`);
  console.log(`   Only in local: ${report.onlyInLocal.length} entries`);

  if (report.onlyInProduction.length > 0 && report.onlyInProduction.length <= 10) {
    console.log(`\n   Production-only IDs: ${report.onlyInProduction.join(', ')}`);
  }

  if (report.onlyInLocal.length > 0 && report.onlyInLocal.length <= 10) {
    console.log(`\n   Local-only IDs: ${report.onlyInLocal.join(', ')}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMENDATION');
  console.log('='.repeat(60));
  console.log(`\n${report.recommendation}\n`);
}

// Execute comparison
compareDatabases()
  .then(printReport)
  .catch(error => {
    console.error('\n❌ Comparison failed:', error.message);
    process.exit(1);
  });
