# Design Systems MCP Server

An AI-powered Model Context Protocol (MCP) server that provides intelligent access to design systems knowledge. This server ingests design system documentation (PDFs, web content) and enables AI assistants to provide expert guidance on design systems, components, tokens, and best practices.

🌐 **Live Demo:** [https://design-systems-mcp.southleft.com/](https://design-systems-mcp.southleft.com/)

## Features

- 🤖 **AI-Powered Chat Interface** - Natural language queries with OpenAI integration
- 📚 **Content Ingestion** - Supports PDF parsing and web content extraction
- 🔍 **Vector Search** - Semantic understanding using Supabase + OpenAI embeddings
- 🎯 **Hybrid Search** - Combines semantic vectors with keyword matching
- 🎨 **Rich Formatting** - Markdown rendering with syntax highlighting
- 🚀 **Cloudflare Workers** - Scalable serverless deployment
- 🧪 **Local Testing** - Full local development environment
- 🌐 **Public Access** - Live MCP server available for external integrations

## Live MCP Server

### 🚀 Public Endpoints

**Workers Domain:** `https://design-systems-mcp.southleft-llc.workers.dev`

- **AI Chat Interface:** [https://design-systems-mcp.southleft.com/](https://design-systems-mcp.southleft.com/)
- **MCP Endpoint:** `https://design-systems-mcp.southleft-llc.workers.dev/mcp`
- **Health Check:** `https://design-systems-mcp.southleft-llc.workers.dev/health`

### ✨ Try It Now

Visit the live demo and ask questions like:
- "What are design tokens and how should I use them?"
- "How do I create accessible button components?"
- "What are the best practices for organizing a design system?"
- "How do components work in design systems?"

## Quick Start

### Prerequisites

- Node.js (v20.17.0+ or v22.9.0+)
- OpenAI API key (for embeddings and chat)
- Supabase account (for vector search)
- PostgreSQL with pgvector extension

### Local Development Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/southleft/design-systems-mcp.git
   cd design-systems-mcp
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your credentials:
   # - Supabase URL and keys
   # - OpenAI API key
   # - Enable vector search
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

   Server will be available at: `http://localhost:8787`

4. **Test the AI Chat Interface**
   - Open `http://localhost:8787` in your browser
   - Try example queries like:
     - "What are design tokens?"
     - "Where in the design systems handbook is Alicia SEDLOCK mentioned?"
     - "What does the Design Systems Handbook say about Wraith, Gemini, and BackstopJS?"
     - "How do I implement a design system?"

### Adding Content with Vector Search

1. **Setup Database** (first time only)
   ```bash
   # Create Supabase tables with pgvector
   npm run setup:database
   ```

2. **Ingest Content with Embeddings**
   ```bash
   # Add PDFs to local-content-library/
   npm run ingest:pdf path/to/your-design-guide.pdf

   # Or ingest web content
   npm run ingest:url https://example.com/design-system

   # Or crawl entire website
   npm run crawl:website https://example.com --depth 2

   # Or bulk ingest from CSV file
   npm run ingest:csv path/to/urls.csv
   
   # Generate embeddings for all content
   npm run ingest:vectors
   ```

2. **Update Content Loading** in `src/index.ts`
   ```typescript
   // Add new content files using dynamic imports
   const [handbookModule, buttonModule, newContentModule] = await Promise.all([
     import('../content/entries/8zWJWrDK_bTOv3_KFo30V-pdf-designsystemshandbook-pdf.json'),
     import('../content/entries/sample-button-guidelines.json'),
     import('../content/entries/your-new-content.json')
   ]);

   const actualEntries = [
     handbookModule.default as ContentEntry,
     buttonModule.default as ContentEntry,
     newContentModule.default as ContentEntry
   ];
   ```

3. **Test Locally**
   ```bash
   npm run dev
   # Test your new content in the chat interface
   ```

## Available Tools

The MCP server provides these tools for AI assistants:

- `search_design_knowledge` - Search design systems content
- `search_chunks` - Find specific information in content chunks
- `browse_by_category` - Browse content by category (components, tokens, etc.)
- `get_all_tags` - Get available content tags

## Local Testing Workflow

### Testing New Content
1. Add content files to `content/entries/`
2. Update `src/index.ts` to load new content
3. Restart dev server: `npm run dev`
4. Test queries in chat interface at `http://localhost:8787`
5. Verify AI responses are accurate and complete

### Testing MCP Tools Directly

**Local Testing:**
```bash
# Test MCP search directly
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_chunks","arguments":{"query":"design tokens"}}}'

# Test AI integration
curl -X POST http://localhost:8787/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What are design tokens?"}'
```

**Production Testing:**
```bash
# Test live MCP endpoint
curl -X POST https://design-systems-mcp.southleft-llc.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_chunks","arguments":{"query":"design tokens"}}}'

# Test live AI integration
curl -X POST https://design-systems-mcp.southleft-llc.workers.dev/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What are design tokens?"}'
```

## Deployment

### Deploy to Cloudflare Workers

1. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Set Environment Variables**
   ```bash
   npx wrangler secret put OPENAI_API_KEY
   # Enter your OpenAI API key when prompted

   # Optional: Set custom model (current default: gpt-4o)
   npx wrangler secret put OPENAI_MODEL
   # Enter model name (default: gpt-4o)
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

4. **Access Your Deployed Server**
   - Your server will be available at: `design-systems-mcp.<your-account>.workers.dev`
   - Chat interface: `https://design-systems-mcp.<your-account>.workers.dev`
   - MCP endpoint: `https://design-systems-mcp.<your-account>.workers.dev/mcp`

### Custom Domain Setup

To set up a custom domain like `design-systems-mcp.southleft.com`:

1. **Deploy your worker** (see steps above)
2. **In Cloudflare Dashboard:**
   - Go to **Workers & Pages** → **Custom Domains**
   - Add your custom domain
   - Point it to your deployed worker: `design-systems-mcp`
3. **Configure DNS** in your domain settings
4. **Test the endpoints** once propagated

### Environment Variables

Required environment variables:

- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model to use (default: "gpt-4o")
- `AI_SYSTEM_PROMPT` - Custom system prompt (optional)

## Connect to MCP Clients

### Claude Desktop / Cursor

Add to your MCP configuration file (`~/.cursor/mcp.json` for Cursor, or `claude_desktop_config.json` for Claude):

**Option 1: Use Public Remote Server (Recommended for most users)**
```json
{
  "mcpServers": {
    "design-systems": {
      "url": "https://design-systems-mcp.southleft-llc.workers.dev/mcp"
    }
  }
}
```

**Option 2: Use Local Development Server (For contributors/customization)**
```json
{
  "mcpServers": {
    "design-systems": {
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

**Important Notes:**
- ✅ Both local and remote servers are fully functional
- 🌐 Remote server: Always available, no setup required
- 🔧 Local server: Requires running `npm run dev` first
- 📝 After updating configuration, restart your MCP client (Cursor/Claude)

### Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your MCP server URL: `design-systems-mcp.southleft-llc.workers.dev/mcp`
3. Start using design systems tools in the playground!

### External Applications

Any application that supports MCP can connect to the live server:

**Endpoint:** `https://design-systems-mcp.southleft-llc.workers.dev/mcp`

**Example API Call:**
```bash
# Initialize connection
curl -X POST https://design-systems-mcp.southleft-llc.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {"roots": {"listChanged": true}},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'

# Search design systems knowledge
curl -X POST https://design-systems-mcp.southleft-llc.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_design_knowledge",
      "arguments": {"query": "design tokens"}
    }
  }'
```

## Project Structure

```
design-systems-mcp/
├── src/
│   ├── index.ts              # Main server with AI integration
│   ├── lib/
│   │   └── content-manager.ts # Content management and search
│   └── tools/                # MCP tool definitions
├── content/
│   ├── entries/              # Ingested content (JSON)
│   └── raw/                  # Raw source files
├── scripts/
│   └── ingestion/            # Content ingestion scripts
├── types/
│   └── content.ts           # TypeScript definitions
├── local-content-library/   # Source PDFs and files
├── wrangler.jsonc          # Cloudflare Workers config
└── .dev.vars              # Local environment variables
```

## Content Management

### Supported Content Types

- **PDFs** - Design system handbooks, guidelines
- **Web Content** - Design system documentation sites
- **CSV URLs** - Bulk ingestion from CSV files containing multiple URLs
- **Website Crawling** - Recursive crawling of entire websites
- **JSON** - Pre-processed design system data

### CSV Bulk Ingestion

For bulk content ingestion, you can use CSV files containing multiple URLs:

#### 1. Create a CSV File

```bash
# Generate a sample CSV template
npm run ingest:csv --sample
```

#### 2. CSV Format

Your CSV file should include these columns (header row recommended):

| Column | Required | Description |
|--------|----------|-------------|
| `url` | ✅ | The URL to fetch content from |
| `title` | ⚪ | Custom title for the content |
| `category` | ⚪ | Content category (general, components, tokens, patterns, guidelines, tools) |
| `tags` | ⚪ | Comma-separated tags |
| `description` | ⚪ | Description of the content |
| `confidence` | ⚪ | Confidence level (low, medium, high) |
| `system` | ⚪ | Design system name |
| `author` | ⚪ | Author or organization |
| `version` | ⚪ | Version information |

#### 3. Example CSV

```csv
url,title,category,tags,description,confidence,system,author,version
https://material.io/components/buttons,Material Design Buttons,components,"button,interaction,material",Material Design button guidelines,high,Material Design,Google,3.0
https://polaris.shopify.com/components/button,Shopify Polaris Button,components,"button,shopify,polaris",Shopify's button component,high,Polaris,Shopify,
https://primer.style/components/button,GitHub Primer Button,components,"button,github,primer",GitHub's button guidelines,high,Primer,GitHub,
```

#### 4. Ingest Content

```bash
# Basic ingestion
npm run ingest:csv my-urls.csv

# With custom options
npm run ingest:csv my-urls.csv --max-concurrent 5 --timeout 60000

# Dry run (validate without fetching)
npm run ingest:csv my-urls.csv --dry-run

# See all options
npm run ingest:csv --help
```

#### 5. Advanced Options

- `--max-concurrent <n>` - Process N URLs simultaneously (default: 3)
- `--timeout <ms>` - Request timeout in milliseconds (default: 30000)
- `--retry-attempts <n>` - Number of retry attempts for failed URLs (default: 2)
- `--output-dir <dir>` - Custom output directory (default: content/entries)
- `--delimiter <char>` - CSV delimiter (default: ',')
- `--no-header` - CSV file doesn't have a header row

### Website Crawling

For comprehensive ingestion of entire websites, use the website crawler:

#### Basic Usage

```bash
# Crawl a website starting from a URL
npm run crawl:website -- https://material.io/design

# With custom depth and page limit
npm run crawl:website -- https://polaris.shopify.com --max-depth 5 --max-pages 200

# Crawl only specific sections
npm run crawl:website -- https://primer.style --include "/components/" --include "/foundations/"

# Resume a previous crawl
npm run crawl:website -- https://material.io/design --resume
```

#### Crawler Options

- `--max-depth <n>` - Maximum crawl depth (default: 3)
- `--max-pages <n>` - Maximum number of pages to crawl (default: 100)
- `--delay <ms>` - Delay between requests in milliseconds (default: 1000)
- `--follow-external` - Follow links to external domains
- `--include <pattern>` - Include URLs matching regex pattern (can be used multiple times)
- `--exclude <pattern>` - Exclude URLs matching regex pattern (can be used multiple times)
- `--no-robots` - Ignore robots.txt
- `--resume` - Resume a previous crawl from the same URL
- `--clear` - Clear previous crawl progress before starting
- `--report` - Generate a crawl report after completion

#### Advanced Examples

```bash
# Exclude certain paths
npm run crawl:website -- https://ant.design --exclude "/changelog" --exclude "/blog"

# Fast crawl with no delay (be careful!)
npm run crawl:website -- https://chakra-ui.com --delay 0 --max-pages 50

# Deep crawl with high limits
npm run crawl:website -- https://design-system.com --max-depth 10 --max-pages 1000 --delay 500

# Generate a report
npm run crawl:website -- https://carbon.ibm.com --report
```

#### Key Features

- **Automatic Progress Saving**: The crawler saves progress every 10 pages and can resume if interrupted
- **Respects robots.txt**: By default, the crawler respects robots.txt directives
- **Smart Link Extraction**: Extracts links from HTML content and follows them recursively
- **Duplicate Detection**: Automatically skips already-visited pages
- **Error Handling**: Continues crawling even if some pages fail
- **Crawl Reports**: Generate detailed reports of crawled content

### Content Processing

Content is automatically:
- Chunked for optimal search performance
- Tagged and categorized
- Indexed for semantic search
- Made available to AI for intelligent responses

## Development

### Available Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run ingest:pdf <file>` - Ingest PDF content
- `npm run ingest:url <url>` - Ingest web content
- `npm run ingest:csv <file>` - Bulk ingest from CSV file containing URLs
- `npm run crawl:website <url>` - Crawl and ingest entire websites
- `npm run check:duplicates` - Check for duplicate URLs in content entries

### Content Quality Assurance

**Check for Duplicate URLs:**
```bash
npm run check:duplicates
```

This command scans all content entries and identifies any duplicate URLs to maintain content quality. Run this:
- Before deploying new content
- After ingesting new articles
- Periodically to ensure data integrity

The checker will show:
- Total entries scanned
- Number of unique URLs found
- Any duplicates with filenames and titles
- Suggested cleanup commands

### Adding New MCP Tools

1. Define tools in `src/index.ts`:
   ```typescript
   server.tool("your_tool_name", schema, async (params) => {
     // Tool implementation
   });
   ```

2. Add to OpenAI function definitions:
   ```typescript
   const MCP_TOOLS = [
     // ... existing tools
     {
       type: "function",
       function: {
         name: "your_tool_name",
         description: "Tool description",
         parameters: { /* JSON schema */ }
       }
     }
   ];
   ```

## Troubleshooting

### Common Issues

**Content not loading:**
- Check that JSON files exist in `content/entries/`
- Verify dynamic import paths in `src/index.ts`
- Check server logs for loading errors
- Ensure content files are valid JSON format

**Port issues:**
- Ensure `wrangler.jsonc` has correct dev port (8787)
- Kill existing processes: `pkill -f "wrangler dev"`

**Environment variables:**
- Local: Use `.dev.vars` file
- Production: Set via `npx wrangler secret put`

### Logs and Debugging

```bash
# View server logs
npx wrangler tail

# Local development logs
npm run dev
# Check console output for content loading status
```

## 📄 **License & Usage**

This project is **free and open source** under the [MIT License](LICENSE). You are welcome to:
- ✅ Use it for personal and commercial projects
- ✅ Modify and distribute it
- ✅ Build upon it for your own projects
- ✅ Share it with your team and community

### **Content Attribution**

This project compiles design system knowledge from many brilliant creators. **All original content remains the intellectual property of their respective authors.**

- 📚 See [CREDITS.md](CREDITS.md) for complete attribution
- 🔗 Always link back to original sources when sharing insights
- 🙏 Support the original creators by visiting their websites and platforms

## 🔒 **Security & Privacy**

- **No sensitive data is stored** - Only public design system knowledge
- **Environment variables are secure** - API keys use Cloudflare secrets
- **Open source and auditable** - All code is publicly available
- **Privacy-focused** - No user data collection beyond basic usage analytics

See [SECURITY.md](SECURITY.md) for detailed security information and best practices.

## 🤝 **Contributing**

We welcome contributions! Whether you want to:
- 🐛 Report bugs or issues
- 💡 Suggest new features or improvements
- 📚 Add more design system content
- 🔧 Improve the codebase
- 📖 Enhance documentation

Please:
1. Check existing [issues](../../issues) first
2. Open a new issue to discuss your idea
3. Submit a pull request with your changes
4. Follow our [security guidelines](SECURITY.md)

### **Adding Content**

To contribute new design system content:
1. Ensure you have permission to share the content
2. Follow the ingestion process documented above
3. Add proper attribution in [CREDITS.md](CREDITS.md)
4. Submit a pull request with the new content

## 🙏 **Acknowledgments**

This project exists thanks to the generous sharing of knowledge from the design systems community. Special thanks to:

- **[Brad Frost](https://bradfrost.com/)** for the foundational Atomic Design methodology
- **[The Design System Guide](https://thedesignsystem.guide/)** team for comprehensive practical resources
- **[Figma](https://www.figma.com/)** for excellent official documentation
- **All the design teams** who openly share their experiences and methodologies
- **The entire design systems community** for fostering knowledge sharing

See [CREDITS.md](CREDITS.md) for the complete list of contributors and sources.

## 📞 **Support & Community**

- 🐛 **Issues:** [GitHub Issues](../../issues)
- 📧 **Security:** Report security issues privately to the maintainers
- 🌐 **Website:** [Live Demo](https://design-systems-mcp.southleft-llc.workers.dev)

---

## Legacy Cloudflare Template Information

This project was built from the Cloudflare remote MCP server template. For additional Cloudflare Workers information:

### Original Template Deploy
[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-authless)

### Command Line Template
```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```
