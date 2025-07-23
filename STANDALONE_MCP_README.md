# Standalone MCP Server for Design Systems Knowledge Base

## Fixed Issues

The standalone MCP server has been updated to fix the following issues:

1. **Content Loading**: Now loads all 113 content files from the manifest instead of just sample data
2. **Metadata Enhancement**: Automatically analyzes content to assign proper categories and extract relevant tags
3. **Improved Search**: Multi-word queries now work with better relevance scoring
4. **Category Mapping**: Content is properly categorized into: figma, tokens, components, documentation, workflow, governance, accessibility, tools, case-studies, foundations

## Key Improvements

### Automatic Metadata Enhancement
- Content without proper metadata is analyzed to extract category and tags
- Categories are assigned based on content keywords
- Tags are extracted from common design system terms, tool names, and system names

### Better Search Algorithm
- Searches now split queries into individual words for better matching
- Relevance scoring based on title matches, content matches, and tag matches
- Multi-word queries like "design system" or "button component" now work properly

### Enhanced Categories
The server now supports these categories:
- `figma` - Figma-related content
- `tokens` - Design tokens content
- `components` - Component documentation
- `documentation` - Documentation guides
- `workflow` - Process and workflow content
- `governance` - Governance and standards
- `accessibility` - Accessibility guidelines
- `tools` - Tools and plugins
- `case-studies` - Case studies and examples
- `foundations` - Foundational principles

## Usage

### Running the Server

```bash
npm run mcp:standalone
```

### Configuring in Claude Desktop

Add this to your Claude Desktop configuration:

```json
{
  "design-systems": {
    "command": "node",
    "args": ["/path/to/your/project/standalone-mcp-server.js"],
    "env": {}
  }
}
```

### Testing the Server

After connecting, you can test with queries like:
- "What is a design system?"
- "Tell me about Figma variables"
- "How do I create design tokens?"
- "Best practices for component documentation"
- "Button component guidelines"

### Debugging

The server logs detailed information to stderr which you can see in Claude Desktop's logs:
- Content loading statistics
- Category distribution
- Top tags extracted
- Search queries and results

## Technical Details

### Content Structure
Each content entry should have:
```json
{
  "id": "unique-id",
  "title": "Entry Title",
  "content": "Full text content",
  "metadata": {
    "category": "components",
    "tags": ["button", "design-system"],
    "confidence": "high"
  },
  "chunks": [...]
}
```

### Tag Extraction
The server automatically extracts tags for:
- Design system concepts (components, tokens, patterns, etc.)
- Tools (Figma, Storybook, GitHub, etc.)
- Design systems (Material Design, Carbon, Polaris, etc.)
- Processes (workflow, governance, documentation)
- Technical terms (accessibility, theming, responsive)

### Search Scoring
Results are scored based on:
- Title matches (highest weight: 10 points)
- Individual word matches in title (3 points each)
- Content phrase matches (5 points)
- Individual word matches in content (1 point each)
- Tag matches (2-5 points depending on exactness)

## Troubleshooting

If content isn't loading:
1. Check that `content/manifest.json` exists
2. Verify content files are in `content/entries/`
3. Look for error messages in the server logs

If searches aren't working well:
1. Check the server logs to see what categories and tags were extracted
2. Try simpler queries or individual keywords
3. Browse by category to see what content is available
