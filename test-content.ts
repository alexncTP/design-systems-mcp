import { loadAllContentEntries } from './src/lib/content-loader';
import { searchEntries } from './src/lib/content-manager';

async function test() {
  console.log("Loading all content entries...");
  const entries = await loadAllContentEntries();
  console.log(`Total entries loaded: ${entries.length}`);
  
  // Check for glossary entries
  const glossaryEntries = entries.filter(e => 
    e.metadata?.category === 'glossary' || 
    e.title?.toLowerCase().includes('glossary')
  );
  console.log(`\nGlossary entries found: ${glossaryEntries.length}`);
  
  glossaryEntries.forEach(entry => {
    console.log(`  - ${entry.title}`);
    const hasSlots = entry.content?.toLowerCase().includes('slot');
    if (hasSlots) {
      console.log(`    ✓ Contains 'slot' reference`);
    }
  });
  
  // Now test search
  console.log("\n=== Testing search for 'what are slots?' ===");
  const results = searchEntries({ query: "what are slots?" });
  console.log(`Search results: ${results.length}`);
  
  if (results.length > 0) {
    results.slice(0, 3).forEach((r, i) => {
      console.log(`${i+1}. ${r.title}`);
    });
  }
}

test().catch(console.error);