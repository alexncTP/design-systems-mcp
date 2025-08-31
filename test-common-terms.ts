import { loadAllContentEntries } from './src/lib/content-loader';
import { searchEntries, loadEntries } from './src/lib/content-manager';

async function test() {
  // Load content first
  const entries = await loadAllContentEntries();
  loadEntries(entries);
  console.log(`Loaded ${entries.length} entries\n`);

  const commonTerms = [
  "what are design tokens?",
  "explain components",
  "what is atomic design?",
  "how do design systems work?",
  "what is a pattern library?",
  "explain typography in design systems",
  "what is accessibility?",
  "explain responsive design",
  "what are breakpoints?",
  "what is a style guide?"
];

console.log("Testing common design system terms:\n");

commonTerms.forEach(query => {
  const results = searchEntries({ query, limit: 5 });
  const status = results.length > 0 ? '✅' : '❌';
  console.log(`${status} "${query}" - ${results.length} results`);
  if (results.length > 0) {
    console.log(`   Top result: ${results[0].title}`);
  }
});
}

test().catch(console.error);