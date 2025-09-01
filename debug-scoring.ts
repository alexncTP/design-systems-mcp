import { loadAllContentEntries } from './src/lib/content-loader';
import { searchEntries, loadEntries, normalizeSearchTerms } from './src/lib/content-manager';

async function debugScoring() {
  console.log("=== Loading content entries ===");
  const entries = await loadAllContentEntries();
  loadEntries(entries);
  
  // Test specific queries that should work
  const queries = [
    "slots",
    "what are slots",
    "what is slots"
  ];
  
  for (const query of queries) {
    console.log(`\n=== Testing query: "${query}" ===`);
    
    // Run search with different limits
    const results5 = searchEntries({ query, limit: 5 });
    const results50 = searchEntries({ query, limit: 50 });
    
    console.log(`Results with limit 5: ${results5.length}`);
    console.log(`Results with limit 50: ${results50.length}`);
    
    if (results5.length > 0) {
      console.log("Top 3 results with limit 5:");
      results5.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i+1}. "${r.title}" (${r.metadata.category})`);
        
        // Check if this entry contains slots
        const hasSlots = r.content?.toLowerCase().includes('slot');
        const hasSlotsInTitle = r.title?.toLowerCase().includes('slot');
        console.log(`     Content has 'slot': ${hasSlots}`);
        console.log(`     Title has 'slot': ${hasSlotsInTitle}`);
        
        if (hasSlots) {
          // Show a snippet of the slots content
          const slotsMatch = r.content?.match(/\d+\s*##\s*Slots[^#]{0,200}/i);
          if (slotsMatch) {
            console.log(`     Slots snippet: "${slotsMatch[0].trim()}"`);
          }
        }
      });
    }
    
    // Test without any filters
    console.log(`\nTesting without filters for "${query}":`);
    const allResults = searchEntries({ query });
    console.log(`Results without filters: ${allResults.length}`);
    
    if (allResults.length === 0) {
      console.log("NO RESULTS - This is the problem!");
      
      // Let's manually check if any entries match
      const manualCheck = entries.filter(entry => {
        const content = entry.content?.toLowerCase() || '';
        const title = entry.title?.toLowerCase() || '';
        return content.includes(query.toLowerCase()) || title.includes(query.toLowerCase());
      });
      
      console.log(`Manual check found ${manualCheck.length} entries that should match`);
      if (manualCheck.length > 0) {
        manualCheck.slice(0, 3).forEach((entry, i) => {
          console.log(`  ${i+1}. "${entry.title}"`);
        });
      }
    }
  }
  
  // Test a simple, guaranteed-to-work search
  console.log(`\n=== Testing guaranteed search: "glossary" ===`);
  const glossaryResults = searchEntries({ query: "glossary" });
  console.log(`Glossary results: ${glossaryResults.length}`);
  
  if (glossaryResults.length > 0) {
    glossaryResults.slice(0, 3).forEach((r, i) => {
      console.log(`  ${i+1}. "${r.title}" (${r.metadata.category})`);
    });
  }
}

debugScoring().catch(console.error);