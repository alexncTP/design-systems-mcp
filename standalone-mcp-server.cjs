#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

// Content storage and search functionality
let entries = [];
let chunkIndex = [];

// Function to extract metadata from content if missing
function enhanceMetadata(entry) {
  // Ensure metadata exists
  if (!entry.metadata) {
    entry.metadata = {};
  }

  // Fix or assign category based on content
  if (!entry.metadata.category || entry.metadata.category === 'general') {
    const contentLower = (entry.title + ' ' + entry.content).toLowerCase();

    if (contentLower.includes('figma') || contentLower.includes('variable') || contentLower.includes('auto layout')) {
      entry.metadata.category = 'figma';
    } else if (contentLower.includes('component') && (contentLower.includes('button') || contentLower.includes('input') || contentLower.includes('form') || contentLower.includes('card'))) {
      entry.metadata.category = 'components';
    } else if (contentLower.includes('token') || contentLower.includes('color') || contentLower.includes('spacing') || contentLower.includes('typography')) {
      entry.metadata.category = 'tokens';
    } else if (contentLower.includes('documentation') || contentLower.includes('document')) {
      entry.metadata.category = 'documentation';
    } else if (contentLower.includes('workflow') || contentLower.includes('process')) {
      entry.metadata.category = 'workflow';
    } else if (contentLower.includes('governance') || contentLower.includes('govern')) {
      entry.metadata.category = 'governance';
    } else if (contentLower.includes('accessibility') || contentLower.includes('a11y') || contentLower.includes('wcag')) {
      entry.metadata.category = 'accessibility';
    } else if (contentLower.includes('tool') || contentLower.includes('plugin')) {
      entry.metadata.category = 'tools';
    } else if (contentLower.includes('case study') || contentLower.includes('case-study')) {
      entry.metadata.category = 'case-studies';
    } else if (contentLower.includes('foundation') || contentLower.includes('principle') || contentLower.includes('guideline')) {
      entry.metadata.category = 'foundations';
    } else {
      entry.metadata.category = 'foundations'; // Default to foundations instead of general
    }
  }

  // Extract tags if missing or empty
  if (!entry.metadata.tags || entry.metadata.tags.length === 0) {
    const tags = new Set();
    const contentLower = (entry.title + ' ' + entry.content).toLowerCase();

    // Common design system terms
    const tagPatterns = [
      { pattern: /\bfigma\b/gi, tag: 'figma' },
      { pattern: /\bvariables?\b/gi, tag: 'variables' },
      { pattern: /\btokens?\b/gi, tag: 'tokens' },
      { pattern: /\bcomponents?\b/gi, tag: 'components' },
      { pattern: /\bbuttons?\b/gi, tag: 'button' },
      { pattern: /\bdesign systems?\b/gi, tag: 'design-system' },
      { pattern: /\batomic design\b/gi, tag: 'atomic-design' },
      { pattern: /\baccessibility\b/gi, tag: 'accessibility' },
      { pattern: /\ba11y\b/gi, tag: 'accessibility' },
      { pattern: /\bgovernance\b/gi, tag: 'governance' },
      { pattern: /\bdocumentation\b/gi, tag: 'documentation' },
      { pattern: /\bstorybook\b/gi, tag: 'storybook' },
      { pattern: /\bgithub\b/gi, tag: 'github' },
      { pattern: /\bgitlab\b/gi, tag: 'gitlab' },
      { pattern: /\btheming\b/gi, tag: 'theming' },
      { pattern: /\bmulti-brand\b/gi, tag: 'multi-brand' },
      { pattern: /\bresponsive\b/gi, tag: 'responsive' },
      { pattern: /\btypography\b/gi, tag: 'typography' },
      { pattern: /\bspacing\b/gi, tag: 'spacing' },
      { pattern: /\bcolors?\b/gi, tag: 'colors' },
      { pattern: /\bpatterns?\b/gi, tag: 'patterns' },
      { pattern: /\bworkflow\b/gi, tag: 'workflow' },
      { pattern: /\bprocess\b/gi, tag: 'process' },
      { pattern: /\bbest practices?\b/gi, tag: 'best-practices' },
      { pattern: /\bguidelines?\b/gi, tag: 'guidelines' },
      { pattern: /\btools?\b/gi, tag: 'tools' },
      { pattern: /\bplugins?\b/gi, tag: 'plugins' },
      { pattern: /\bcase stud/gi, tag: 'case-study' },
    ];

    tagPatterns.forEach(({ pattern, tag }) => {
      if (pattern.test(contentLower)) {
        tags.add(tag);
      }
    });

    // Extract system names
    const systemPatterns = [
      { pattern: /\bmaterial design\b/gi, tag: 'material-design' },
      { pattern: /\bcarbon\b/gi, tag: 'carbon' },
      { pattern: /\bpolaris\b/gi, tag: 'polaris' },
      { pattern: /\bprimer\b/gi, tag: 'primer' },
      { pattern: /\bchakra\b/gi, tag: 'chakra' },
      { pattern: /\bant design\b/gi, tag: 'ant-design' },
      { pattern: /\btailwind\b/gi, tag: 'tailwind' },
      { pattern: /\bbootstrap\b/gi, tag: 'bootstrap' },
    ];

    systemPatterns.forEach(({ pattern, tag }) => {
      if (pattern.test(contentLower)) {
        tags.add(tag);
      }
    });

    entry.metadata.tags = Array.from(tags).slice(0, 15); // Limit to 15 tags
  }

  return entry;
}

function loadAllContent() {
  try {
    // Load the manifest
    const manifestPath = path.join(__dirname, 'content/manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ Manifest file not found at:', manifestPath);
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.error(`📄 Found manifest with ${manifest.total_files} files`);

    // Load each content file
    let successCount = 0;
    manifest.files.forEach(filename => {
      try {
        const filePath = path.join(__dirname, 'content/entries', filename);
        if (fs.existsSync(filePath)) {
          let content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          // Enhance metadata if needed
          content = enhanceMetadata(content);

          entries.push(content);

          // Index chunks for better searching
          if (content.chunks && Array.isArray(content.chunks)) {
            content.chunks.forEach(chunk => {
              chunkIndex.push({
                chunk,
                entry: content,
                entryId: content.id,
                entryTitle: content.title
              });
            });
          }

          successCount++;
        }
      } catch (error) {
        console.error(`⚠️ Failed to load ${filename}:`, error.message);
      }
    });

    console.error(`✅ Successfully loaded ${successCount}/${manifest.total_files} content entries`);
    console.error(`📊 Total chunks indexed: ${chunkIndex.length}`);

    // Log category distribution
    const categories = {};
    entries.forEach(entry => {
      const category = entry.metadata?.category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });
    console.error('📁 Categories:', categories);

    // Log tag distribution (top 20)
    const tagCounts = {};
    entries.forEach(entry => {
      (entry.metadata?.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => `${tag}(${count})`)
      .join(', ');
    console.error('🏷️ Top tags:', topTags);

  } catch (error) {
    console.error('❌ Error loading content:', error);
  }
}

// Enhanced search with better matching
function searchEntries({ query, category, tags, limit = 15 }) {
  console.error(`🔍 Searching for: "${query}" in category: ${category || 'all'}`);

  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

  const scoredResults = entries.map(entry => {
    let score = 0;

    // Title matching (highest weight)
    const titleLower = entry.title.toLowerCase();
    if (titleLower.includes(normalizedQuery)) {
      score += 10; // Exact phrase match in title
    }
    queryWords.forEach(word => {
      if (titleLower.includes(word)) {
        score += 3; // Individual word match in title
      }
    });

    // Content matching
    const contentLower = (entry.content || '').toLowerCase();
    if (contentLower.includes(normalizedQuery)) {
      score += 5; // Exact phrase match in content
    }
    queryWords.forEach(word => {
      if (contentLower.includes(word)) {
        score += 1; // Individual word match in content
      }
    });

    // URL matching (if it's a URL-based entry)
    const urlLower = (entry.metadata?.url || '').toLowerCase();
    queryWords.forEach(word => {
      if (urlLower.includes(word)) {
        score += 2;
      }
    });

    // Tag matching
    const entryTags = entry.metadata?.tags || [];
    entryTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (tagLower === normalizedQuery) {
        score += 5; // Exact tag match
      } else if (queryWords.some(word => tagLower.includes(word))) {
        score += 2; // Partial tag match
      }
    });

    // Category filter
    if (category && entry.metadata?.category !== category) {
      score = 0; // Exclude if doesn't match category
    }

    // Tag filter
    if (tags && tags.length > 0) {
      const hasMatchingTag = tags.some(tag =>
        entryTags.some(entryTag =>
          entryTag.toLowerCase() === tag.toLowerCase()
        )
      );
      if (!hasMatchingTag) {
        score = 0; // Exclude if doesn't have required tags
      }
    }

    return { entry, score };
  })
  .filter(result => result.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)
  .map(result => result.entry);

  console.error(`Found ${scoredResults.length} results`);
  return scoredResults;
}

// Enhanced chunk search
function searchChunks(query, limit = 8) {
  console.error(`🎯 Searching chunks for: "${query}"`);

  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);

  const scoredResults = chunkIndex.map(item => {
    let score = 0;
    const chunkText = (item.chunk.text || '').toLowerCase();

    // Exact phrase match
    if (chunkText.includes(normalizedQuery)) {
      score += 5;
    }

    // Word matches
    queryWords.forEach(word => {
      if (chunkText.includes(word)) {
        score += 1;
      }
    });

    // Boost if chunk metadata indicates relevance
    const section = (item.chunk.metadata?.section || '').toLowerCase();
    if (section.includes(normalizedQuery) || queryWords.some(w => section.includes(w))) {
      score += 2;
    }

    return { ...item, score };
  })
  .filter(result => result.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

  console.error(`Found ${scoredResults.length} chunk results`);
  return scoredResults;
}

function getEntriesByCategory(category) {
  console.error(`📁 Getting entries for category: ${category}`);
  const filtered = entries.filter(entry =>
    (entry.metadata?.category || 'uncategorized') === category
  );
  console.error(`Found ${filtered.length} entries in category ${category}`);
  return filtered;
}

function getAllTags() {
  console.error('🏷️ Getting all tags');
  const tagSet = new Set();
  entries.forEach(entry => {
    (entry.metadata?.tags || []).forEach(tag => tagSet.add(tag));
  });
  const tags = Array.from(tagSet).sort();
  console.error(`Found ${tags.length} unique tags`);
  return tags;
}

// Create the MCP server
const server = new Server(
  {
    name: 'design-systems-knowledge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Load content on startup
loadAllContent();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('📋 Listing tools...');
  return {
    tools: [
      {
        name: 'search_design_knowledge',
        description: 'Search through design system knowledge base entries by query, category, or tags',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for finding relevant design system knowledge',
            },
            category: {
              type: 'string',
              description: 'Filter by category (e.g., "figma", "tokens", "components")',
              enum: ['figma', 'tokens', 'components', 'documentation', 'workflow', 'governance', 'accessibility', 'tools', 'case-studies', 'foundations'],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by specific tags',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 15)',
              default: 15,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_chunks',
        description: 'Search through specific content chunks for detailed information',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for finding specific content chunks',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of chunks to return (default: 8)',
              default: 8,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'browse_by_category',
        description: 'Browse all entries in a specific category',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Category to browse',
              enum: ['figma', 'tokens', 'components', 'documentation', 'workflow', 'governance', 'accessibility', 'tools', 'case-studies', 'foundations'],
            },
          },
          required: ['category'],
        },
      },
      {
        name: 'get_all_tags',
        description: 'Get a list of all available tags in the knowledge base',
        inputSchema: {
          type: 'object',
          properties: {
            random_string: {
              type: 'string',
              description: 'Dummy parameter for no-parameter tools',
            },
          },
          required: ['random_string'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`🛠️ Tool called: ${name} with args:`, args);

  try {
    switch (name) {
      case 'search_design_knowledge': {
        const results = searchEntries(args);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No design system knowledge found matching your search criteria.',
              },
            ],
          };
        }

        const formattedResults = results.map((entry, index) => {
          const category = entry.metadata?.category || 'uncategorized';
          const tags = entry.metadata?.tags || [];
          const system = entry.metadata?.system || 'N/A';
          const content = entry.content || '';

          return `**${index + 1}. ${entry.title}**

*Category:* ${category}
*System:* ${system}
*Tags:* ${tags.join(', ')}

${content.slice(0, 300)}${content.length > 300 ? '...' : ''}

---`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `**Found ${results.length} result${results.length === 1 ? '' : 's'}:**

${formattedResults}`,
            },
          ],
        };
      }

      case 'search_chunks': {
        const results = searchChunks(args.query, args.limit || 8);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No specific information found matching your query.',
              },
            ],
          };
        }

        const formattedChunks = results.map((result, index) => {
          const section = result.chunk.metadata?.section || 'EXCERPT';
          const relevance = (result.score / 10).toFixed(2);

          return `**${index + 1}. ${section}**

*From:* ${result.entryTitle}
*Relevance Score:* ${relevance}

> "${result.chunk.text}"

---`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `**Found ${results.length} relevant chunk${results.length === 1 ? '' : 's'}:**

${formattedChunks}`,
            },
          ],
        };
      }

      case 'browse_by_category': {
        const categoryEntries = getEntriesByCategory(args.category);

        if (categoryEntries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No entries found in category: ${args.category}`,
              },
            ],
          };
        }

        const formattedEntries = categoryEntries.map((entry, index) => {
          const tags = entry.metadata?.tags || [];
          const system = entry.metadata?.system || 'N/A';

          return `**${index + 1}. ${entry.title}**
*Tags:* ${tags.join(', ')}
*System:* ${system}`;
        }).join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `**${categoryEntries.length} entr${categoryEntries.length === 1 ? 'y' : 'ies'} in "${args.category}":**

${formattedEntries}`,
            },
          ],
        };
      }

      case 'get_all_tags': {
        const tags = getAllTags();
        return {
          content: [
            {
              type: 'text',
              text: `**Available tags (${tags.length}):** ${tags.join(', ')}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error('Tool execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool "${name}": ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  console.error('🚀 Starting Design Systems MCP Server...');
  console.error(`📚 Loaded ${entries.length} entries`);
  console.error(`📊 Indexed ${chunkIndex.length} chunks`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ MCP Server connected and ready!');
}

main().catch((error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
