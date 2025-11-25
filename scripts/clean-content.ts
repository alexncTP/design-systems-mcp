/**
 * Content Cleaning Pipeline
 *
 * Removes noise from scraped content to improve AI readability:
 * - Navigation menu spam
 * - Company directory listings
 * - Markdown link syntax
 * - Advertisement placeholders
 * - Footer content
 * - Duplicate chunks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ContentEntry {
  id: string;
  title: string;
  source: {
    type: string;
    location: string;
    ingested_at: string;
  };
  content: string;
  chunks: Array<{
    id: string;
    text: string;
    metadata: {
      startIndex: number;
      endIndex: number;
      chunkIndex: number;
      section: string;
      globalChunkIndex: number;
    };
  }>;
  metadata: {
    category: string;
    tags: string[];
    confidence: string;
    last_updated: string;
    source_url: string;
  };
}

interface CleaningStats {
  originalLength: number;
  cleanedLength: number;
  reductionPercent: number;
  patternsRemoved: {
    navigationHeaders: number;
    companyLists: number;
    markdownLinks: number;
    advertisements: number;
    footers: number;
  };
}

/**
 * Clean content by removing noise patterns
 */
function cleanContent(content: string): { cleaned: string; stats: CleaningStats } {
  const original = content;
  let cleaned = content;
  const stats: CleaningStats = {
    originalLength: content.length,
    cleanedLength: 0,
    reductionPercent: 0,
    patternsRemoved: {
      navigationHeaders: 0,
      companyLists: 0,
      markdownLinks: 0,
      advertisements: 0,
      footers: 0,
    },
  };

  // 1. Remove navigation header spam (first ~900 chars)
  // Pattern: "# CompanyName Systems Directories Components Articles... Subscribe"
  const navHeaderPattern = /^#\s+\w+\s+Systems\s+Directories\s+Components\s+Articles\s+Blueprints\s+Guides\s+Glossary.*?Subscribe\s*/s;
  if (navHeaderPattern.test(cleaned)) {
    cleaned = cleaned.replace(navHeaderPattern, '');
    stats.patternsRemoved.navigationHeaders++;
  }

  // 2. Remove company directory listings
  // Pattern: Long lists of company names (Adobe Alaska Airlines Amazon Apple...)
  const companyListPattern = /(?:Adobe|Alaska Airlines|Amazon|Apple|Atlassian|Audi|Basis|Biings|Brainly)(?:\s+(?:Adobe|Alaska Airlines|Amazon|Apple|Atlassian|Audi|Basis|Biings|Brainly|Carrefour|Cash App|CBRE Build|Cisco|Datadog|Dell|Docplanner|eBay|Elastic|Esri|General Electric|Github|GitLab|Google|GOV\.UK|Gusto|Helly Hansen|IBM|Ideagen|INPS|Kajabi|Kiwicom|Lemon Squeezy|Line|LocalTapiola|Michelin|Microsoft|Monday\.com|MongoDB|Motorway|Mozilla|Nordhealth|Ontario|Orange|Palantir|Pinterest|Pluralsight|Porsche|Razorpay|Red Hat|Rei|Salesforce|Samsung|Seek|Segment|ServiceNow|Shopify|Skoda|Sprout Social|SumUp|Sunrise|Teamleader|Thumbtack|Twilio|U\.S\. Web|UAE|Uber|Vercel|Visa|Washington Post|Wikimedia|Wise|Wonderflow|Workday|WorkOS|Zendesk)){10,}/g;
  const companyListMatches = cleaned.match(companyListPattern) || [];
  if (companyListMatches.length > 0) {
    cleaned = cleaned.replace(companyListPattern, '');
    stats.patternsRemoved.companyLists = companyListMatches.length;
  }

  // 3. Convert markdown links to plain text [Text](url) → Text
  const markdownLinkPattern = /\[([^\]]+)\]\([^)]+\)/g;
  const markdownLinkMatches = cleaned.match(markdownLinkPattern) || [];
  if (markdownLinkMatches.length > 0) {
    cleaned = cleaned.replace(markdownLinkPattern, '$1');
    stats.patternsRemoved.markdownLinks = markdownLinkMatches.length;
  }

  // 4. Remove advertisement placeholders and "View source" text
  const adPattern = /\b(?:Advertisement|View source)\b/gi;
  const adMatches = cleaned.match(adPattern) || [];
  if (adMatches.length > 0) {
    cleaned = cleaned.replace(adPattern, '');
    stats.patternsRemoved.advertisements = adMatches.length;
  }

  // 5. Remove footer content
  const footerPattern = /Design\s*\.surf\s*©\s*Dzeya\s*OÜ\.?/gi;
  const footerMatches = cleaned.match(footerPattern) || [];
  if (footerMatches.length > 0) {
    cleaned = cleaned.replace(footerPattern, '');
    stats.patternsRemoved.footers = footerMatches.length;
  }

  // 6. Clean up multiple spaces and newlines
  cleaned = cleaned
    .replace(/\s+/g, ' ')  // Multiple spaces → single space
    .replace(/\s+\./g, '.')  // Space before period
    .replace(/\s+,/g, ',')  // Space before comma
    .trim();

  // 7. Remove common navigation text patterns
  const navPatterns = [
    /Created by\s+/gi,
    /Keep up with the latest in Design Systems\s+/gi,
    /Biweekly Digest\s+/gi,
    /\d+Biweekly Digest/gi,
  ];

  navPatterns.forEach(pattern => {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '');
    }
  });

  stats.cleanedLength = cleaned.length;
  stats.reductionPercent = Math.round(
    ((stats.originalLength - stats.cleanedLength) / stats.originalLength) * 100
  );

  return { cleaned, stats };
}

/**
 * Regenerate chunks from cleaned content
 */
function regenerateChunks(content: string, chunkSize = 800, overlap = 200): Array<{
  id: string;
  text: string;
  metadata: {
    startIndex: number;
    endIndex: number;
    chunkIndex: number;
    section: string;
    globalChunkIndex: number;
  };
}> {
  const chunks = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < content.length) {
    const endIndex = Math.min(startIndex + chunkSize, content.length);
    const text = content.substring(startIndex, endIndex);

    chunks.push({
      id: `chunk-${chunkIndex}`,
      text,
      metadata: {
        startIndex,
        endIndex,
        chunkIndex,
        section: 'Content',
        globalChunkIndex: chunkIndex,
      },
    });

    startIndex += chunkSize - overlap;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Clean a single content entry file
 */
function cleanEntry(entry: ContentEntry): { entry: ContentEntry; stats: CleaningStats } {
  const { cleaned, stats } = cleanContent(entry.content);

  // Update entry with cleaned content
  const cleanedEntry: ContentEntry = {
    ...entry,
    content: cleaned,
    chunks: regenerateChunks(cleaned),
  };

  return { entry: cleanedEntry, stats };
}

/**
 * Process a single file
 */
async function processFile(filePath: string, outputDir: string): Promise<CleaningStats | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const entry: ContentEntry = JSON.parse(content);

    const { entry: cleanedEntry, stats } = cleanEntry(entry);

    // Write cleaned entry to output directory
    const fileName = path.basename(filePath);
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, JSON.stringify(cleanedEntry, null, 2));

    return stats;
  } catch (error) {
    console.error(`  ⚠️  Error processing ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

/**
 * Process all content files
 */
async function cleanAllContent() {
  const contentDir = path.join(__dirname, '../content/entries');
  const outputDir = path.join(__dirname, '../content/cleaned');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🧹 Content Cleaning Pipeline\n');
  console.log(`📂 Input:  ${contentDir}`);
  console.log(`📂 Output: ${outputDir}\n`);

  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.json'));
  console.log(`📊 Found ${files.length} files to clean\n`);

  const totalStats: CleaningStats = {
    originalLength: 0,
    cleanedLength: 0,
    reductionPercent: 0,
    patternsRemoved: {
      navigationHeaders: 0,
      companyLists: 0,
      markdownLinks: 0,
      advertisements: 0,
      footers: 0,
    },
  };

  let processedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(contentDir, file);
    const stats = await processFile(filePath, outputDir);

    if (stats) {
      totalStats.originalLength += stats.originalLength;
      totalStats.cleanedLength += stats.cleanedLength;
      totalStats.patternsRemoved.navigationHeaders += stats.patternsRemoved.navigationHeaders;
      totalStats.patternsRemoved.companyLists += stats.patternsRemoved.companyLists;
      totalStats.patternsRemoved.markdownLinks += stats.patternsRemoved.markdownLinks;
      totalStats.patternsRemoved.advertisements += stats.patternsRemoved.advertisements;
      totalStats.patternsRemoved.footers += stats.patternsRemoved.footers;
      processedCount++;
    } else {
      errorCount++;
    }

    if ((processedCount + errorCount) % 10 === 0) {
      console.log(`  Processed ${processedCount}/${files.length} files... (${errorCount} errors)`);
    }
  }

  totalStats.reductionPercent = Math.round(
    ((totalStats.originalLength - totalStats.cleanedLength) / totalStats.originalLength) * 100
  );

  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANING COMPLETE');
  console.log('='.repeat(60));
  console.log(`\n📊 Statistics:`);
  console.log(`   Files processed: ${processedCount}/${files.length}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Original size: ${(totalStats.originalLength / 1024).toFixed(0)} KB`);
  console.log(`   Cleaned size: ${(totalStats.cleanedLength / 1024).toFixed(0)} KB`);
  console.log(`   Reduction: ${totalStats.reductionPercent}%`);
  console.log(`\n🎯 Patterns Removed:`);
  console.log(`   Navigation headers: ${totalStats.patternsRemoved.navigationHeaders}`);
  console.log(`   Company lists: ${totalStats.patternsRemoved.companyLists}`);
  console.log(`   Markdown links: ${totalStats.patternsRemoved.markdownLinks}`);
  console.log(`   Advertisements: ${totalStats.patternsRemoved.advertisements}`);
  console.log(`   Footers: ${totalStats.patternsRemoved.footers}`);
  console.log();

  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} files had errors and were skipped.`);
    console.log(`   Check the error messages above for details.\n`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanAllContent().catch(console.error);
}

export { cleanContent, cleanEntry, cleanAllContent, regenerateChunks };
