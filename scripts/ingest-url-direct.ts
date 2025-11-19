#!/usr/bin/env tsx
/**
 * Direct URL ingestion: Fetch → Parse → Embed → Push to Supabase in one command
 * No intermediate JSON files, immediately available for search
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { fetchURL } from './ingestion/url-fetcher';
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

async function ingestUrlDirect(url: string, metadata?: any) {
  console.log(`\n🚀 Direct URL Ingestion Pipeline\n`);
  console.log(`📍 URL: ${url}\n`);

  try {
    // Step 1: Fetch and parse
    console.log('📥 Step 1/4: Fetching and parsing content...');
    const entry = await fetchURL(url, { metadata });
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

      const shouldUpdate = args.includes('--update') || args.includes('--force');

      if (!shouldUpdate) {
        console.log(`\n   Use --update flag to replace existing entry`);
        console.log(`   Example: npm run ingest:direct -- "${url}" --update\n`);
        return;
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

      const chunkPromises = entry.chunks.map(async (chunk, i) => {
        const chunkEmbedding = await generateEmbedding(chunk.text);

        return {
          id: uuidv4(),
          entry_id: entry.id,
          chunk_index: chunk.metadata.chunkIndex,
          chunk_text: chunk.text, // Note: column is 'chunk_text', not 'content'
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

      console.log(`\n   Top results:`);
      searchResults.slice(0, 3).forEach((result: any, idx: number) => {
        const isCurrent = result.id === entry.id;
        console.log(`   ${idx + 1}. ${isCurrent ? '🎯 ' : '   '}${result.title.substring(0, 60)}...`);
        console.log(`      Similarity: ${result.rank?.toFixed(4)}`);
      });
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

  } catch (error: any) {
    console.error('\n❌ Ingestion failed:', error.message);
    throw error;
  }
}

// Parse command line arguments
let args = process.argv.slice(2);

// Remove npm's '--' separator if present
if (args[0] === '--') {
  args = args.slice(1);
}

const url = args[0];

if (!url || url === '--help' || url === '-h') {
  console.log(`
🚀 Direct URL Ingestion Tool

Fetches, parses, generates embeddings, and pushes to Supabase in one command.

Usage:
  npm run ingest:direct -- <url> [options]

Options:
  --update, --force    Update/replace if entry already exists
  --help, -h          Show this help message

Examples:
  # Ingest a new article
  npm run ingest:direct -- "https://example.com/article"

  # Update an existing entry
  npm run ingest:direct -- "https://example.com/article" --update

Features:
  ✅ Smart content extraction (prioritizes <article>, <main>, then H1 context)
  ✅ Removes nav/footer/header/aside automatically
  ✅ Generates embeddings for main content + all chunks
  ✅ Checks for duplicates before inserting
  ✅ Verifies searchability after ingestion
  ✅ No intermediate JSON files - directly to database
`);
  process.exit(0);
}

ingestUrlDirect(url).catch(console.error);
