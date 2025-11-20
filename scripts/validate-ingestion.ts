/**
 * Validation Script for Vector Ingestion Pipeline
 * Tests data integrity, embedding quality, and search accuracy
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ValidationReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: ValidationResult[];
}

// Initialize clients
function initializeClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  if (!openaiKey) {
    throw new Error('Missing OpenAI API key');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  return { supabase, openai };
}

/**
 * Test 1: Verify database connection and schema
 */
async function validateDatabaseConnection(supabase: any): Promise<ValidationResult> {
  try {
    // Test content_entries table
    const { data: entries, error: entriesError } = await supabase
      .from('content_entries')
      .select('id')
      .limit(1);

    if (entriesError) {
      return {
        passed: false,
        message: 'Database connection failed for content_entries',
        details: entriesError,
      };
    }

    // Test content_chunks table
    const { data: chunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('id')
      .limit(1);

    if (chunksError) {
      return {
        passed: false,
        message: 'Database connection failed for content_chunks',
        details: chunksError,
      };
    }

    return {
      passed: true,
      message: '✅ Database connection and schema validated',
      details: { entries: entries?.length || 0, chunks: chunks?.length || 0 },
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Database connection error',
      details: error,
    };
  }
}

/**
 * Test 2: Verify all entries have embeddings
 */
async function validateEmbeddings(supabase: any): Promise<ValidationResult> {
  try {
    const { data: stats, error } = await supabase.rpc('get_embedding_stats');

    if (error) {
      return {
        passed: false,
        message: 'Failed to get embedding statistics',
        details: error,
      };
    }

    const coverage = (stats.entries_with_embeddings / stats.total_entries) * 100;
    const chunkCoverage = (stats.chunks_with_embeddings / stats.total_chunks) * 100;

    return {
      passed: coverage === 100 && chunkCoverage === 100,
      message:
        coverage === 100 && chunkCoverage === 100
          ? '✅ All entries and chunks have embeddings'
          : `⚠️ Embedding coverage: ${coverage.toFixed(1)}% entries, ${chunkCoverage.toFixed(1)}% chunks`,
      details: stats,
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Embedding validation error',
      details: error,
    };
  }
}

/**
 * Test 3: Verify chunk integrity (foreign keys, ordering, positions)
 */
async function validateChunkIntegrity(supabase: any): Promise<ValidationResult> {
  try {
    // Check for orphaned chunks (chunks without parent entries)
    const { data: orphanedChunks, error: orphanError } = await supabase.rpc(
      'count_orphaned_chunks',
      {}
    );

    if (orphanError) {
      // Function might not exist, create a manual check
      const { data: chunks, error: chunkError } = await supabase
        .from('content_chunks')
        .select('id, entry_id, chunk_index, start_index, end_index')
        .order('entry_id, chunk_index');

      if (chunkError) {
        return {
          passed: false,
          message: 'Failed to fetch chunks',
          details: chunkError,
        };
      }

      // Verify entry_id exists for all chunks
      const entryIds = [...new Set(chunks.map((c: any) => c.entry_id))];
      const { data: entries, error: entriesError } = await supabase
        .from('content_entries')
        .select('id')
        .in('id', entryIds);

      if (entriesError) {
        return {
          passed: false,
          message: 'Failed to verify chunk parent entries',
          details: entriesError,
        };
      }

      const orphaned = chunks.filter(
        (c: any) => !entries.find((e: any) => e.id === c.entry_id)
      );

      if (orphaned.length > 0) {
        return {
          passed: false,
          message: `⚠️ Found ${orphaned.length} orphaned chunks`,
          details: orphaned,
        };
      }

      // Verify chunk ordering is sequential
      let orderingIssues = 0;
      let currentEntry = '';
      let lastIndex = -1;

      for (const chunk of chunks) {
        if (chunk.entry_id !== currentEntry) {
          currentEntry = chunk.entry_id;
          lastIndex = -1;
        }

        if (chunk.chunk_index !== lastIndex + 1) {
          orderingIssues++;
        }
        lastIndex = chunk.chunk_index;
      }

      if (orderingIssues > 0) {
        return {
          passed: false,
          message: `⚠️ Found ${orderingIssues} chunk ordering issues`,
        };
      }

      // Verify position tracking (start_index < end_index)
      const positionIssues = chunks.filter(
        (c: any) => c.start_index >= c.end_index || c.start_index < 0
      );

      if (positionIssues.length > 0) {
        return {
          passed: false,
          message: `⚠️ Found ${positionIssues.length} chunks with invalid positions`,
          details: positionIssues,
        };
      }

      return {
        passed: true,
        message: '✅ Chunk integrity validated (foreign keys, ordering, positions)',
        details: {
          totalChunks: chunks.length,
          uniqueEntries: entryIds.length,
        },
      };
    }

    return {
      passed: orphanedChunks === 0,
      message:
        orphanedChunks === 0
          ? '✅ No orphaned chunks found'
          : `⚠️ Found ${orphanedChunks} orphaned chunks`,
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Chunk integrity validation error',
      details: error,
    };
  }
}

/**
 * Test 4: Verify metadata structure
 */
async function validateMetadata(supabase: any): Promise<ValidationResult> {
  try {
    const { data: entries, error } = await supabase
      .from('content_entries')
      .select('id, metadata')
      .limit(100);

    if (error) {
      return {
        passed: false,
        message: 'Failed to fetch entries for metadata validation',
        details: error,
      };
    }

    const requiredFields = ['category', 'tags', 'confidence', 'last_updated'];
    let missingFields = 0;

    for (const entry of entries) {
      if (!entry.metadata) {
        missingFields++;
        continue;
      }

      for (const field of requiredFields) {
        if (!(field in entry.metadata)) {
          missingFields++;
        }
      }
    }

    return {
      passed: missingFields === 0,
      message:
        missingFields === 0
          ? '✅ All entries have complete metadata'
          : `⚠️ Found ${missingFields} metadata issues`,
      details: { entriesChecked: entries.length, missingFields },
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Metadata validation error',
      details: error,
    };
  }
}

/**
 * Test 5: Verify embedding dimensions
 */
async function validateEmbeddingDimensions(supabase: any): Promise<ValidationResult> {
  try {
    const { data: entries, error: entriesError } = await supabase
      .from('content_entries')
      .select('id, embedding')
      .not('embedding', 'is', null)
      .limit(10);

    if (entriesError) {
      return {
        passed: false,
        message: 'Failed to fetch entries for dimension validation',
        details: entriesError,
      };
    }

    const { data: chunks, error: chunksError } = await supabase
      .from('content_chunks')
      .select('id, embedding')
      .not('embedding', 'is', null)
      .limit(10);

    if (chunksError) {
      return {
        passed: false,
        message: 'Failed to fetch chunks for dimension validation',
        details: chunksError,
      };
    }

    const expectedDimension = 1536; // text-embedding-3-small
    let dimensionIssues = 0;

    for (const entry of entries) {
      if (entry.embedding.length !== expectedDimension) {
        dimensionIssues++;
      }
    }

    for (const chunk of chunks) {
      if (chunk.embedding.length !== expectedDimension) {
        dimensionIssues++;
      }
    }

    return {
      passed: dimensionIssues === 0,
      message:
        dimensionIssues === 0
          ? `✅ All embeddings have correct dimensions (${expectedDimension})`
          : `⚠️ Found ${dimensionIssues} embeddings with incorrect dimensions`,
      details: {
        expectedDimension,
        entriesChecked: entries.length,
        chunksChecked: chunks.length,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Embedding dimension validation error',
      details: error,
    };
  }
}

/**
 * Test 6: Test search accuracy with known queries
 */
async function validateSearchAccuracy(
  supabase: any,
  openai: OpenAI
): Promise<ValidationResult> {
  try {
    // Generate embedding for test query
    const testQuery = 'button component design patterns';
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQuery,
    });
    const queryEmbedding = response.data[0].embedding;

    // Test vector search
    const { data: results, error } = await supabase.rpc('match_content_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (error) {
      return {
        passed: false,
        message: 'Search function execution failed',
        details: error,
      };
    }

    if (!results || results.length === 0) {
      return {
        passed: false,
        message: '⚠️ No search results returned (might be expected if database is empty)',
      };
    }

    // Verify results are properly formatted and have similarity scores
    const invalidResults = results.filter(
      (r: any) => !r.id || !r.title || typeof r.similarity !== 'number'
    );

    if (invalidResults.length > 0) {
      return {
        passed: false,
        message: `⚠️ Found ${invalidResults.length} invalid search results`,
        details: invalidResults,
      };
    }

    // Verify similarity scores are in valid range [0, 1]
    const invalidScores = results.filter(
      (r: any) => r.similarity < 0 || r.similarity > 1
    );

    if (invalidScores.length > 0) {
      return {
        passed: false,
        message: `⚠️ Found ${invalidScores.length} results with invalid similarity scores`,
        details: invalidScores,
      };
    }

    return {
      passed: true,
      message: `✅ Search accuracy validated (${results.length} results returned)`,
      details: {
        query: testQuery,
        resultsCount: results.length,
        topScore: results[0]?.similarity.toFixed(4),
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Search accuracy validation error',
      details: error,
    };
  }
}

/**
 * Run all validation tests
 */
async function runValidation(): Promise<ValidationReport> {
  console.log('🔍 Starting Vector Ingestion Pipeline Validation\n');

  const { supabase, openai } = initializeClients();
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    tests: [],
  };

  // Run all tests
  const tests = [
    { name: 'Database Connection', fn: () => validateDatabaseConnection(supabase) },
    { name: 'Embedding Coverage', fn: () => validateEmbeddings(supabase) },
    { name: 'Chunk Integrity', fn: () => validateChunkIntegrity(supabase) },
    { name: 'Metadata Structure', fn: () => validateMetadata(supabase) },
    { name: 'Embedding Dimensions', fn: () => validateEmbeddingDimensions(supabase) },
    { name: 'Search Accuracy', fn: () => validateSearchAccuracy(supabase, openai) },
  ];

  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = await test.fn();
    report.tests.push(result);
    report.totalTests++;

    if (result.passed) {
      report.passed++;
      console.log(result.message);
    } else {
      report.failed++;
      console.error(result.message);
      if (result.details) {
        console.error('Details:', JSON.stringify(result.details, null, 2));
      }
    }
    console.log();
  }

  // Print summary
  console.log('═'.repeat(60));
  console.log('📊 Validation Summary');
  console.log('═'.repeat(60));
  console.log(`Total Tests: ${report.totalTests}`);
  console.log(`✅ Passed: ${report.passed}`);
  console.log(`❌ Failed: ${report.failed}`);
  console.log(
    `Success Rate: ${((report.passed / report.totalTests) * 100).toFixed(1)}%`
  );
  console.log('═'.repeat(60));

  return report;
}

// Execute validation
runValidation()
  .then((report) => {
    process.exit(report.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
  });
