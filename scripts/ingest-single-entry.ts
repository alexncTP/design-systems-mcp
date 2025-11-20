#!/usr/bin/env tsx
/**
 * Ingest a single specific JSON entry to Supabase with vectors
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
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

async function ingestSingleEntry(jsonPath: string) {
  console.log(`📥 Reading entry from: ${jsonPath}\n`);

  const content = await fs.readFile(jsonPath, 'utf-8');
  const entry = JSON.parse(content);

  console.log(`📄 Title: ${entry.title}`);
  console.log(`🆔 ID: ${entry.id}`);
  console.log(`📍 Source: ${entry.source.location}\n`);

  // Check if entry already exists
  const { data: existing } = await supabase
    .from('content_entries')
    .select('id')
    .eq('id', entry.id)
    .single();

  if (existing) {
    console.log('⚠️  Entry already exists in database. Skipping...');
    return;
  }

  // Generate embedding for main content
  console.log('🧮 Generating embedding for main content...');
  const mainEmbedding = await generateEmbedding(entry.content);

  // Prepare entry for database
  const dbEntry = {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    source_type: entry.source.type,
    source_location: entry.source.location,
    category: entry.metadata?.category || 'articles',
    system_name: entry.metadata?.system || 'Southleft',
    tags: entry.metadata?.tags || ['context-based-design-systems', 'ai', 'design-systems'],
    confidence: entry.metadata?.confidence || 'high',
    embedding: JSON.stringify(mainEmbedding),
    ingested_at: entry.source.ingested_at,
    metadata: {
      author: 'TJ Pitre',
      company: 'Southleft',
      type: 'thought-leadership',
      ingested_via: 'single-entry-script'
    }
  };

  // Insert main entry
  console.log('💾 Inserting main entry into database...');
  const { error: entryError } = await supabase
    .from('content_entries')
    .insert([dbEntry]);

  if (entryError) {
    console.error('❌ Failed to insert entry:', entryError);
    return;
  }

  console.log('✅ Main entry inserted successfully!\n');

  // Insert chunks
  if (entry.chunks && entry.chunks.length > 0) {
    console.log(`📦 Processing ${entry.chunks.length} chunks...\n`);

    for (let i = 0; i < entry.chunks.length; i++) {
      const chunk = entry.chunks[i];

      console.log(`  ${i + 1}/${entry.chunks.length}: Generating embedding for chunk ${chunk.id}...`);

      const chunkEmbedding = await generateEmbedding(chunk.text);

      const dbChunk = {
        id: uuidv4(),
        entry_id: entry.id,
        chunk_index: chunk.metadata.chunkIndex,
        content: chunk.text,
        embedding: JSON.stringify(chunkEmbedding),
        metadata: chunk.metadata
      };

      const { error: chunkError } = await supabase
        .from('content_chunks')
        .insert([dbChunk]);

      if (chunkError) {
        console.error(`  ❌ Failed to insert chunk ${i}:`, chunkError.message);
      } else {
        console.log(`  ✅ Chunk ${i + 1} inserted`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n✅ All chunks processed!\n');
  }

  // Test vector search
  console.log('🔍 Testing vector search for "context-based design systems"...\n');
  const testQuery = 'context-based design systems';
  const queryEmbedding = await generateEmbedding(testQuery);

  const { data: searchResults, error: searchError } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: testQuery,
    match_threshold: 0.15,
    match_count: 5
  });

  if (searchError) {
    console.error('❌ Search error:', searchError);
  } else {
    console.log(`Found ${searchResults.length} results:\n`);
    searchResults.forEach((result: any, idx: number) => {
      const isContextBased = result.title.toLowerCase().includes('context-based');
      console.log(`${idx + 1}. ${isContextBased ? '🎯 ' : '   '}${result.title}`);
      console.log(`   Similarity: ${result.rank?.toFixed(4)}`);
    });
  }

  console.log('\n🎉 Ingestion complete!');
}

const entryPath = process.argv[2] || '/Users/tjpitre/Sites/design-systems-mcp/content/entries/jbR4o1hXq_-gH2nsOixlC-context-based-design-systems-a-new-model-for-the-a.json';

ingestSingleEntry(entryPath).catch(console.error);
