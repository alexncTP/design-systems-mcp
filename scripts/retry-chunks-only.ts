/**
 * Retry chunk ingestion for entries that have no chunks
 * These are entries where the main upload succeeded but chunks failed
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { loadAllContentEntries } from '../src/lib/content-loader';
import { chunkText } from '../src/lib/chunker';

dotenv.config();

async function retryChunksOnly() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  console.log('🔄 Retrying chunk ingestion for entries without chunks\n');

  // Find entries without chunks
  const { data: allEntries } = await supabase
    .from('content_entries')
    .select('id, title');

  if (!allEntries) {
    console.log('❌ Could not load entries');
    return;
  }

  const entriesWithoutChunks: string[] = [];

  for (const entry of allEntries) {
    const { count } = await supabase
      .from('content_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('entry_id', entry.id);

    if (count === 0) {
      entriesWithoutChunks.push(entry.id);
    }
  }

  console.log(`📊 Found ${entriesWithoutChunks.length} entries without chunks`);

  if (entriesWithoutChunks.length === 0) {
    console.log('✅ All entries already have chunks!');
    return;
  }

  // Load all content to find matching entries
  const contentEntries = await loadAllContentEntries();
  let successCount = 0;
  let failCount = 0;

  console.log(`\n🚀 Processing ${entriesWithoutChunks.length} entries...\n`);

  for (const entryId of entriesWithoutChunks) {
    const contentEntry = contentEntries.find(e => e.id === entryId);

    if (!contentEntry) {
      console.log(`⚠️  Skipping ${entryId} - not found in content files`);
      continue;
    }

    try {
      console.log(`Processing: ${contentEntry.title}`);

      // Generate chunks
      const chunks = chunkText(contentEntry.content, {
        chunkSize: 1000,
        overlapSize: 100,
        preserveSentences: true,
      });

      if (chunks.length <= 1) {
        console.log(`  ℹ️  Only ${chunks.length} chunk - skipping (single chunk entries don't need chunks table)`);
        successCount++;
        continue;
      }

      // Generate embeddings
      const chunkEmbeddings = await Promise.all(
        chunks.map(async (chunk) => ({
          text: chunk.text,
          index: chunk.metadata!.chunkIndex,
          startIndex: chunk.metadata!.startIndex,
          endIndex: chunk.metadata!.endIndex,
          embedding: await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk.text,
          }).then(r => r.data[0].embedding),
        }))
      );

      // Upload with correct schema
      const chunksToInsert = chunkEmbeddings.map(chunk => ({
        entry_id: entryId,
        chunk_text: chunk.text,
        embedding: chunk.embedding,
        chunk_index: chunk.index,
        metadata: {
          chunk_size: chunk.text.length,
          section: 'Content',
          start_index: chunk.startIndex,
          end_index: chunk.endIndex,
        },
      }));

      const { error } = await supabase
        .from('content_chunks')
        .insert(chunksToInsert);

      if (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        failCount++;
      } else {
        console.log(`  ✅ Uploaded ${chunkEmbeddings.length} chunks`);
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n📊 Results:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  // Final verification
  const { count: finalChunks } = await supabase
    .from('content_chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Final chunk count: ${finalChunks}`);
  console.log('\n✨ Chunk retry complete!');
}

retryChunksOnly().catch(console.error);
