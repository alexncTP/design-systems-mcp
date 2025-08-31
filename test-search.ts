import { normalizeSearchTerms, searchEntries } from './src/lib/content-manager';

// Test the search for "what are slots?"
const query = "what are slots?";
console.log("\n=== Testing search for: 'what are slots?' ===\n");

// First, check what search terms are extracted
const searchTerms = normalizeSearchTerms(query);
console.log("Extracted search terms:", searchTerms);

// Now test the actual search
const results = searchEntries({ query, limit: 10 });
console.log("\nNumber of results found:", results.length);

if (results.length > 0) {
  console.log("\nTop results:");
  results.slice(0, 3).forEach((entry, i) => {
    console.log(`\n${i + 1}. ${entry.title}`);
    console.log("   Category:", entry.metadata.category);
    console.log("   Tags:", entry.metadata.tags.join(", "));
    
    // Check if content contains "slots"
    const contentLower = entry.content.toLowerCase();
    const slotsCount = (contentLower.match(/\bslots?\b/g) || []).length;
    console.log("   'Slots' mentions in content:", slotsCount);
  });
} else {
  console.log("\nNo results found!");
  
  // Let's check the glossary files directly
  console.log("\n=== Checking glossary files for 'slots' ===");
  const glossaryResults = searchEntries({ category: 'glossary' });
  glossaryResults.forEach(entry => {
    const contentLower = entry.content.toLowerCase();
    if (contentLower.includes('slots')) {
      console.log(`\nFound 'slots' in: ${entry.title}`);
      const matches = contentLower.match(/.{0,100}\bslots?\b.{0,100}/g);
      if (matches) {
        console.log("Context snippets:");
        matches.slice(0, 2).forEach(m => console.log(`  - ${m.trim()}`));
      }
    }
  });
}