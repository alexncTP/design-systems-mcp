import { loadAllContentEntries } from './src/lib/content-loader';
import { searchEntries, loadEntries, normalizeSearchTerms } from './src/lib/content-manager';

async function debugSlotsSearch() {
  console.log("=== Loading all content entries ===");
  const entries = await loadAllContentEntries();
  console.log(`Total entries loaded: ${entries.length}`);
  
  // Load into content manager
  console.log("\n=== Loading entries into content manager ===");
  loadEntries(entries);
  
  // Find entries with 'slots' content
  console.log("\n=== Finding entries with 'slots' content ===");
  const entriesWithSlots = entries.filter(entry => {
    const hasSlots = entry.content?.toLowerCase().includes('slot');
    if (hasSlots) {
      console.log(`✓ Found 'slots' in: ${entry.title}`);
      // Look for the actual slots definition
      const slotsMatch = entry.content?.match(/## Slots[^#]+/i);
      if (slotsMatch) {
        console.log(`  Slots definition: ${slotsMatch[0].substring(0, 200)}...`);
      }
    }
    return hasSlots;
  });
  
  console.log(`\nEntries with 'slots' content: ${entriesWithSlots.length}`);
  
  // Test search term normalization
  console.log("\n=== Testing search term normalization ===");
  const queries = ['slots', 'what are slots', 'slot', 'placeholder'];
  
  for (const query of queries) {
    const terms = normalizeSearchTerms(query);
    console.log(`Query: "${query}" → Terms: [${terms.join(', ')}]`);
    
    // Test the search
    const results = searchEntries({ query });
    console.log(`  Search results: ${results.length}`);
    
    if (results.length > 0) {
      results.slice(0, 2).forEach((r, i) => {
        console.log(`    ${i+1}. ${r.title} (${r.metadata.category})`);
      });
    } else {
      // Check if the issue is with score thresholds
      console.log(`  No results for "${query}" - checking manually...`);
      
      // Manual check for exact matches
      const manualMatches = entries.filter(entry => {
        const content = entry.content?.toLowerCase() || '';
        const title = entry.title?.toLowerCase() || '';
        const queryLower = query.toLowerCase();
        
        return content.includes(queryLower) || title.includes(queryLower) || 
               entry.metadata.tags?.some(tag => tag.toLowerCase().includes(queryLower));
      });
      
      console.log(`    Manual matches found: ${manualMatches.length}`);
      if (manualMatches.length > 0) {
        manualMatches.slice(0, 2).forEach((r, i) => {
          console.log(`      ${i+1}. ${r.title} (${r.metadata.category})`);
        });
      }
    }
  }
}

debugSlotsSearch().catch(console.error);