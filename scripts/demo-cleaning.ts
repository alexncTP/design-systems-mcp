/**
 * Simple demo of content cleaning on one file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanEntry } from './clean-content.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function demo() {
  const files = [
    '-6QHXo9Tw1d9SSW1d18C5-url-helix-design-system-ui-framework-from-ideagen.json',
    '_7eJsTV3BMfqs9T-eRcmF-url-samsung-design-system-one-ui-framework.json',
    '_o17fACBvAAwkmyYLwlgs-url-amazon-design-system-cloudscape.json',
  ];

  console.log('🧹 Content Cleaning Demo\n');
  console.log('Testing on 3 sample files\n');
  console.log('='.repeat(80));

  for (const file of files) {
    try {
      const filePath = path.join(__dirname, '../content/entries', file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(content);

      const { entry: cleanedEntry, stats } = cleanEntry(entry);

      console.log(`\n📄 ${entry.title}`);
      console.log('-'.repeat(80));
      console.log(`\n🔴 BEFORE (first 600 chars):`);
      console.log(entry.content.substring(0, 600) + '...\n');

      console.log(`✅ AFTER (first 600 chars):`);
      console.log(cleanedEntry.content.substring(0, 600) + '...\n');

      console.log(`📊 Improvement:`);
      console.log(`   Original: ${stats.originalLength} chars | ${entry.chunks.length} chunks`);
      console.log(`   Cleaned:  ${stats.cleanedLength} chars | ${cleanedEntry.chunks.length} chunks`);
      console.log(`   Reduction: ${stats.reductionPercent}%`);
      console.log(`   Patterns removed: ${JSON.stringify(stats.patternsRemoved, null, 2)}`);

      console.log('\n' + '='.repeat(80));
    } catch (error) {
      console.error(`\n❌ Error processing ${file}:`, error.message);
      console.log('='.repeat(80));
    }
  }

  console.log(`\n✨ Demo complete!\n`);
}

demo().catch(console.error);
