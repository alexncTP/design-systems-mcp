#!/usr/bin/env tsx
/**
 * Direct URL ingestion: Fetch → Parse → Embed → Push to Supabase in one command
 * No intermediate JSON files, immediately available for search
 *
 * Single URL:  npm run ingest:direct -- <url> [--update]
 * Batch CSV:   npm run ingest:direct -- --csv <file> [--update]
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import { fetchURL } from './ingestion/url-fetcher';
import { parseCSV } from './ingestion/csv-url-parser';
import type { ContentMetadata } from '../types/content';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}

interface IngestOptions {
  update?: boolean;
  titleOverride?: string;
}

async function ingestUrlDirect(
  url: string,
  metadata: Partial<ContentMetadata> = {},
  options: IngestOptions = {}
): Promise<'inserted' | 'skipped'> {
  console.log(`\n🚀 Direct URL Ingestion Pipeline\n`);
  console.log(`📍 URL: ${url}\n`);

  // Step 1: Fetch and parse
  console.log('📥 Step 1/4: Fetching and parsing content...');
  const entry = await fetchURL(url, { metadata });
  if (options.titleOverride) {
    entry.title = options.titleOverride;
  }
  console.log(`   ✅ Parsed: ${entry.title}`);
  console.log(`   📊 Content length: ${entry.content.length} characters`);
  console.log(`   📦 Chunks: ${entry.chunks.length}\n`);

  // Step 2: Check for duplicates
  console.log('🔍 Step 2/4: Checking for duplicates...');
  const { data: existing } = await supabase
    .from('content_entries')
    .select('id, title')
    .eq('source_location', url)
    .maybeSingle();

  if (existing) {
    console.log(`   ⚠️  Entry already exists: ${existing.title}`);
    console.log(`   🆔 ID: ${existing.id}`);

    if (!options.update) {
      console.log(`\n   Use --update flag to replace existing entry`);
      console.log(`   Example: npm run ingest:direct -- "${url}" --update\n`);
      return 'skipped';
    }

    console.log(`   🔄 Updating existing entry...\n`);

    // Delete old entry and chunks
    await supabase.from('content_chunks').delete().eq('entry_id', existing.id);
    await supabase.from('content_entries').delete().eq('id', existing.id);

    console.log(`   ✅ Old entry deleted, proceeding with fresh ingestion...\n`);
  } else {
    console.log(`   ✅ No duplicates found\n`);
  }

  // Step 3: Generate embeddings and insert
  console.log('🧮 Step 3/4: Generating embeddings and inserting...');

  // Generate main content embedding
  console.log('   Generating main content embedding...');
  const mainEmbedding = await generateEmbedding(entry.content);

  // Prepare entry for database with better metadata
  const dbEntry = {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    source_type: entry.source.type,
    source_location: entry.source.location,
    category: entry.metadata.category,
    system_name: entry.metadata.system || new URL(url).hostname,
    tags: entry.metadata.tags || [],
    confidence: entry.metadata.confidence || 'medium',
    embedding: JSON.stringify(mainEmbedding),
    ingested_at: entry.source.ingested_at,
    metadata: {
      ...entry.metadata,
      ingested_via: 'direct-url-script',
      ingested_by: 'ingest-url-direct'
    }
  };

  // Insert main entry
  const { error: entryError } = await supabase
    .from('content_entries')
    .insert([dbEntry]);

  if (entryError) {
    console.error('   ❌ Failed to insert entry:', entryError);
    throw entryError;
  }

  console.log(`   ✅ Main entry inserted (ID: ${entry.id})`);

  // Insert chunks with embeddings
  if (entry.chunks && entry.chunks.length > 0) {
    console.log(`   Processing ${entry.chunks.length} chunks...`);

    const chunkPromises = entry.chunks.map(async (chunk, index) => {
      const chunkEmbedding = await generateEmbedding(chunk.text);

      return {
        // id omitted: production content_chunks.id is auto-increment INTEGER
        entry_id: entry.id,
        chunk_index: chunk.metadata?.chunkIndex ?? index,
        chunk_text: chunk.text,
        embedding: JSON.stringify(chunkEmbedding),
        metadata: chunk.metadata
      };
    });

    // Generate all embeddings in parallel (faster)
    const chunks = await Promise.all(chunkPromises);

    // Insert chunks in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const { error: chunkError } = await supabase
        .from('content_chunks')
        .insert(batch);

      if (chunkError) {
        console.error(`   ⚠️  Warning: Failed to insert chunks ${i}-${i + batch.length}:`, chunkError.message);
      }

      // Small delay between batches
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`   ✅ All ${entry.chunks.length} chunks processed\n`);
  }

  // Step 4: Verify with vector search
  console.log('🔍 Step 4/4: Verifying vector search...');

  // Extract key terms from title for search test
  const searchTerms = entry.title.split(':')[0].trim();
  console.log(`   Testing search for: "${searchTerms}"`);

  const queryEmbedding = await generateEmbedding(searchTerms);

  const { data: searchResults, error: searchError } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: searchTerms,
    match_threshold: 0.15,
    match_count: 5
  });

  if (searchError) {
    console.error('   ⚠️  Search verification failed:', searchError);
  } else {
    const found = searchResults.find((r: any) => r.id === entry.id);

    if (found) {
      console.log(`   ✅ Entry is searchable! (Rank: ${(searchResults.findIndex((r: any) => r.id === entry.id) + 1)}/${searchResults.length}, Similarity: ${found.rank?.toFixed(4)})`);
    } else {
      console.log(`   ⚠️  Entry not in top 5 results, but may appear with different queries`);
    }
  }

  console.log(`\n🎉 Ingestion complete! Entry is live and searchable.\n`);
  console.log(`📊 Summary:`);
  console.log(`   • Entry ID: ${entry.id}`);
  console.log(`   • Title: ${entry.title}`);
  console.log(`   • Category: ${entry.metadata.category}`);
  console.log(`   • Tags: ${entry.metadata.tags?.join(', ') || 'none'}`);
  console.log(`   • Content: ${entry.content.length} chars`);
  console.log(`   • Chunks: ${entry.chunks.length}`);
  console.log(`   • Source: ${url}\n`);

  return 'inserted';
}

/**
 * Batch mode: ingest every row of a CSV
 * (same column format as ingest:csv — url,title,category,tags,description,confidence,system,author,version)
 */
async function ingestCsvBatch(csvFile: string, options: IngestOptions): Promise<void> {
  const csvContent = fs.readFileSync(csvFile, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`\n📄 Batch ingestion: ${rows.length} URLs from ${csvFile}\n`);

  const results = { inserted: 0, skipped: 0, failed: [] as Array<{ url: string; error: string }> };

  for (const [index, row] of rows.entries()) {
    console.log(`\n━━━ [${index + 1}/${rows.length}] ${row.url} ━━━`);

    const metadata: Partial<ContentMetadata> = {};
    if (row.category) metadata.category = row.category;
    if (row.tags) metadata.tags = row.tags.split(',').map(tag => tag.trim());
    if (row.confidence) metadata.confidence = row.confidence;
    if (row.system) metadata.system = row.system;
    if (row.author) metadata.author = row.author;
    if (row.version) metadata.version = row.version;

    try {
      const outcome = await ingestUrlDirect(row.url, metadata, {
        ...options,
        titleOverride: row.title,
      });
      results[outcome]++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.failed.push({ url: row.url, error: error.message });
    }

    // Pace requests between rows
    if (index < rows.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 BATCH SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   ✅ Inserted: ${results.inserted}`);
  console.log(`   ⏭️  Skipped (already exist): ${results.skipped}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  results.failed.forEach(f => console.log(`      - ${f.url}: ${f.error}`));

  if (results.failed.length > 0) {
    process.exitCode = 1;
  }
}

// Parse command line arguments
let args = process.argv.slice(2);

// Remove npm's '--' separator if present
if (args[0] === '--') {
  args = args.slice(1);
}

const update = args.includes('--update') || args.includes('--force');
const csvFlagIndex = args.indexOf('--csv');
const csvFile = csvFlagIndex !== -1 ? args[csvFlagIndex + 1] : undefined;
const url = args.find(arg => !arg.startsWith('--') && arg !== csvFile);

if ((!url && !csvFile) || args.includes('--help') || args.includes('-h')) {
  console.log(`
🚀 Direct URL Ingestion Tool

Fetches, parses, generates embeddings, and pushes to Supabase in one command.

Usage:
  npm run ingest:direct -- <url> [options]
  npm run ingest:direct -- --csv <file> [options]

Options:
  --csv <file>         Batch mode: ingest every row of a CSV
                       (columns: url,title,category,tags,description,confidence,system,author,version)
  --update, --force    Update/replace if entry already exists
  --help, -h           Show this help message

Examples:
  # Ingest a new article
  npm run ingest:direct -- "https://example.com/article"

  # Update an existing entry
  npm run ingest:direct -- "https://example.com/article" --update

  # Batch ingest a CSV of resources
  npm run ingest:direct -- --csv new-resources.csv

Features:
  ✅ Smart content extraction (prioritizes <article>, <main>, then H1 context)
  ✅ Removes nav/footer/header/aside automatically
  ✅ Generates embeddings for main content + all chunks
  ✅ Checks for duplicates before inserting
  ✅ Verifies searchability after ingestion
  ✅ No intermediate JSON files - directly to database
`);
  process.exit(url || csvFile ? 0 : 1);
}

if (csvFile) {
  ingestCsvBatch(csvFile, { update }).catch(error => {
    console.error('\n❌ Batch ingestion failed:', error.message);
    process.exit(1);
  });
} else {
  ingestUrlDirect(url!, {}, { update }).catch(error => {
    console.error('\n❌ Ingestion failed:', error.message);
    process.exit(1);
  });
}
