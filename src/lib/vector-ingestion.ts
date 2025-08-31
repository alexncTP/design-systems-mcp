/**
 * Vector Ingestion Pipeline for Supabase
 * Generates embeddings and uploads content to vector database
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ContentEntry } from '../../types/content';
import { loadAllContentEntries } from './content-loader';

// Types
interface IngestionOptions {
  batchSize?: number;
  chunkSize?: number;
  clearExisting?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

interface IngestionResult {
  total: number;
  successful: number;
  failed: number;
  cost: number;
  duration: number;
  errors: Array<{ id: string; error: string }>;
}

// Initialize clients
function initializeClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY');
  }

  if (!openaiKey) {
    throw new Error('Missing OpenAI API key. Please set OPENAI_API_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  return { supabase, openai };
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(
  openai: OpenAI,
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model,
      input: text.slice(0, 8191), // Max tokens for embedding model
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Chunk text for granular search
 */
function chunkText(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Upload content entry to Supabase
 */
async function uploadEntry(
  supabase: any,
  entry: ContentEntry,
  embedding: number[]
): Promise<void> {
  const { error } = await supabase
    .from('content_entries')
    .upsert({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      source_type: entry.source?.type,
      source_location: entry.source?.location,
      category: entry.metadata?.category,
      system_name: entry.metadata?.system_name,
      tags: entry.metadata?.tags || [],
      confidence: entry.metadata?.confidence,
      embedding,
      metadata: entry.metadata,
      ingested_at: entry.source?.ingested_at || new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to upload entry ${entry.id}: ${error.message}`);
  }
}

/**
 * Upload content chunks to Supabase
 */
async function uploadChunks(
  supabase: any,
  entryId: string,
  chunks: Array<{ text: string; embedding: number[]; index: number }>
): Promise<void> {
  const chunksToInsert = chunks.map(chunk => ({
    entry_id: entryId,
    chunk_index: chunk.index,
    chunk_text: chunk.text,
    embedding: chunk.embedding,
    metadata: { chunk_size: chunk.text.length },
  }));

  const { error } = await supabase
    .from('content_chunks')
    .upsert(chunksToInsert);

  if (error) {
    throw new Error(`Failed to upload chunks for ${entryId}: ${error.message}`);
  }
}

/**
 * Process a single content entry
 */
async function processEntry(
  supabase: any,
  openai: OpenAI,
  entry: ContentEntry,
  options: IngestionOptions
): Promise<{ success: boolean; error?: string; cost: number }> {
  try {
    if (options.verbose) {
      console.log(`Processing: ${entry.title}`);
    }

    // Generate embedding for full content
    const fullText = `${entry.title}\n\n${entry.content}`;
    const embedding = await generateEmbedding(openai, fullText);

    // Upload main entry
    if (!options.dryRun) {
      await uploadEntry(supabase, entry, embedding);
    }

    // Process chunks if content is long
    const chunks = chunkText(entry.content, options.chunkSize);
    if (chunks.length > 1) {
      const chunkEmbeddings = await Promise.all(
        chunks.map(async (text, index) => ({
          text,
          index,
          embedding: await generateEmbedding(openai, text),
        }))
      );

      if (!options.dryRun) {
        await uploadChunks(supabase, entry.id, chunkEmbeddings);
      }
    }

    // Estimate cost (text-embedding-3-small: $0.00002 per 1K tokens)
    const totalTokens = Math.ceil((fullText.length + chunks.join('').length) / 4);
    const cost = (totalTokens / 1000) * 0.00002;

    if (options.verbose) {
      console.log(`✅ Processed: ${entry.title} (${chunks.length} chunks, $${cost.toFixed(4)})`);
    }

    return { success: true, cost };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed: ${entry.title} - ${errorMessage}`);
    return { success: false, error: errorMessage, cost: 0 };
  }
}

/**
 * Main ingestion function
 */
export async function ingestContent(options: IngestionOptions = {}): Promise<IngestionResult> {
  const startTime = Date.now();
  const {
    batchSize = 10,
    chunkSize = 1000,
    clearExisting = false,
    verbose = false,
    dryRun = false,
  } = options;

  console.log('🚀 Starting vector ingestion pipeline...');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be uploaded');
  }

  // Initialize clients
  const { supabase, openai } = initializeClients();

  // Clear existing data if requested
  if (clearExisting && !dryRun) {
    console.log('🗑️  Clearing existing data...');
    await supabase.from('content_chunks').delete().neq('id', 0);
    await supabase.from('content_entries').delete().neq('id', '0');
  }

  // Load content entries
  console.log('📚 Loading content entries...');
  const entries = await loadAllContentEntries();
  console.log(`📄 Found ${entries.length} entries to process`);

  // Process in batches
  const results: IngestionResult = {
    total: entries.length,
    successful: 0,
    failed: 0,
    cost: 0,
    duration: 0,
    errors: [],
  };

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, Math.min(i + batchSize, entries.length));
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)}`);

    const batchResults = await Promise.all(
      batch.map(entry => processEntry(supabase, openai, entry, { ...options, chunkSize }))
    );

    for (const [index, result] of batchResults.entries()) {
      if (result.success) {
        results.successful++;
        results.cost += result.cost;
      } else {
        results.failed++;
        results.errors.push({
          id: batch[index].id,
          error: result.error || 'Unknown error',
        });
      }
    }

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  results.duration = (Date.now() - startTime) / 1000;

  // Print summary
  console.log('\n📊 Ingestion Summary:');
  console.log(`✅ Successful: ${results.successful}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`💰 Estimated cost: $${results.cost.toFixed(4)}`);
  console.log(`⏱️  Duration: ${results.duration.toFixed(2)} seconds`);

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.slice(0, 5).forEach(err => {
      console.log(`  - ${err.id}: ${err.error}`);
    });
    if (results.errors.length > 5) {
      console.log(`  ... and ${results.errors.length - 5} more`);
    }
  }

  return results;
}

/**
 * Update a single entry's embedding
 */
export async function updateEntryEmbedding(
  entryId: string,
  content?: string
): Promise<void> {
  const { supabase, openai } = initializeClients();

  // Fetch entry if content not provided
  if (!content) {
    const { data, error } = await supabase
      .from('content_entries')
      .select('title, content')
      .eq('id', entryId)
      .single();

    if (error || !data) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    content = `${data.title}\n\n${data.content}`;
  }

  // Generate new embedding
  const embedding = await generateEmbedding(openai, content);

  // Update in database
  const { error } = await supabase
    .from('content_entries')
    .update({ embedding, updated_at: new Date().toISOString() })
    .eq('id', entryId);

  if (error) {
    throw new Error(`Failed to update embedding: ${error.message}`);
  }

  console.log(`✅ Updated embedding for ${entryId}`);
}