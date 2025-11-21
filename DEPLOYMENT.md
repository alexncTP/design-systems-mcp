# Deployment Guide - SSE Transport with OAuth for Claude Desktop

This guide covers deploying the Design Systems MCP server with SSE (Server-Sent Events) transport and OAuth 2.0 support for Claude Desktop's "Add custom connector" UI.

## OAuth Implementation

This server implements **minimal OAuth 2.0** ("anonymous OAuth") to satisfy Claude Desktop's authentication requirements while remaining publicly accessible:

- **No user accounts** - Anyone can get a token
- **No passwords** - Auto-approves all authorization requests
- **Tokens are valid for 1 year** - Effectively permanent access
- **Security theater** - OAuth for UI compatibility, not actual authentication

This allows using Claude Desktop's "Add custom connector" UI without manual JSON configuration.

## Prerequisites

- Cloudflare Workers paid plan (required for Durable Objects)
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare account authenticated (`wrangler login`)
- Environment secrets configured:
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_ANON_KEY`

## Architecture Overview

The SSE implementation uses Cloudflare Durable Objects to maintain persistent session state:

- **GET /sse** - Establishes SSE connection with Claude Desktop
- **POST /sse/message** - Receives MCP requests from Claude Desktop
- **SSESession Durable Object** - Manages session state, routing, and heartbeat

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Local Environment

Create a `.dev.vars` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Start Local Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8787` with:
- SSE endpoint: `http://localhost:8787/sse`
- Original MCP endpoint: `http://localhost:8787/mcp`
- AI chat UI: `http://localhost:8787/ai-chat`

### 4. Test SSE Connection Locally

You can test the SSE connection using curl:

```bash
# Establish SSE connection
curl -N http://localhost:8787/sse

# You should see SSE messages including:
# - endpoint message with session URL
# - initialize message with MCP capabilities
# - heartbeat comments every 15 seconds
```

## Production Deployment

### 1. Set Environment Secrets

Configure production secrets in Cloudflare:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put SUPABASE_ANON_KEY
```

Each command will prompt you to enter the secret value.

### 2. Deploy to Cloudflare Workers

```bash
npm run deploy
```

This command:
1. Builds the TypeScript code
2. Creates the Durable Object migration
3. Deploys the Worker to Cloudflare's edge network
4. Returns your production URL (e.g., `https://design-systems-mcp.southleft.com`)

### 3. Verify Deployment

After deployment, test the SSE endpoint:

```bash
curl -N https://your-worker-url.workers.dev/sse
```

You should see the same SSE messages as in local testing.

## Connecting to Claude Desktop

### Using the "Add Custom Connector" UI

1. Open Claude Desktop application
2. Click on settings or menu (look for MCP/connectors option)
3. Select **"Add custom connector"** or similar option
4. You'll see a modal with input fields
5. Enter the following:
   - **Name**: `Design Systems Assistant`
   - **Remote MCP server URL**: `https://your-worker-url.workers.dev/sse`
6. Click **Connect** or **Add**

### What Happens Next

1. Claude Desktop establishes an SSE connection to `/sse`
2. The SSESession Durable Object:
   - Generates a unique session ID
   - Sends the message endpoint URL: `/sse/message?sessionId={id}`
   - Sends MCP initialization with available tools
   - Starts 15-second heartbeat to keep connection alive
3. Claude Desktop registers the four MCP tools:
   - `search_design_knowledge` - Search design system knowledge base
   - `search_chunks` - Search specific content chunks
   - `browse_by_category` - Browse entries by category
   - `get_all_tags` - List available tags
4. You can now prompt Claude Desktop with design system questions!

### Example Prompts

Once connected, try these prompts in Claude Desktop:

```
Search for button component best practices

Show me design tokens for spacing

Browse components category

What are the available tags in the knowledge base?

How should I implement accessibility in buttons?
```

## Troubleshooting

### Connection Errors

**Issue**: Claude Desktop shows "Connection failed" or similar error

**Solutions**:
1. Verify the URL is correct and accessible:
   ```bash
   curl -N https://your-worker-url.workers.dev/sse
   ```
2. Check Cloudflare Workers logs:
   ```bash
   wrangler tail
   ```
3. Ensure Durable Objects are enabled on your Cloudflare plan
4. Verify all environment secrets are set correctly:
   ```bash
   wrangler secret list
   ```

### Session Timeout

**Issue**: Connection drops after a period of inactivity

**Cause**: Default 30-minute session timeout or network interruption

**Solution**: Reconnect using Claude Desktop UI. Sessions are automatically cleaned up and new sessions are created on reconnection.

### No Response from Tools

**Issue**: Claude Desktop connects but tools return no data

**Solutions**:
1. Check Supabase connection and credentials
2. Verify vector search is enabled in `wrangler.jsonc`:
   ```jsonc
   "VECTOR_SEARCH_ENABLED": "true"
   ```
3. Check Cloudflare Workers logs for errors:
   ```bash
   wrangler tail --format pretty
   ```
4. Test tool execution directly via curl:
   ```bash
   # Get session endpoint from SSE stream
   curl -N https://your-worker-url.workers.dev/sse

   # Send tool call to message endpoint
   curl -X POST "https://your-worker-url.workers.dev/sse/message?sessionId=YOUR_SESSION_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "search_design_knowledge",
         "arguments": {
           "query": "button"
         }
       }
     }'
   ```

### CORS Issues

**Issue**: Browser console shows CORS errors

**Solution**: The implementation includes `Access-Control-Allow-Origin: *` headers. If issues persist, check:
1. Browser extensions blocking requests
2. Corporate firewall/proxy settings
3. Cloudflare security settings

### Durable Objects Not Available

**Issue**: "Durable Objects are not available" error during deployment

**Solution**:
1. Verify you have a paid Cloudflare Workers plan
2. Check `wrangler.jsonc` has correct Durable Objects configuration
3. Run migration explicitly:
   ```bash
   wrangler deploy --legacy-env false
   ```

## Monitoring and Logging

### View Real-Time Logs

```bash
wrangler tail --format pretty
```

Key log messages to look for:
- `[SSE] New session created: {sessionId}` - Connection established
- `[SSE] Received message for {sessionId}: {method}` - Tool call received
- `[SSE] Heartbeat failed for {sessionId}` - Connection lost
- `[SSE] Cleaning up stale session: {sessionId}` - Timeout cleanup

### Performance Metrics

Monitor in Cloudflare Dashboard:
- **Requests per second** - Total traffic to SSE endpoints
- **Durable Object duration** - Session processing time
- **Error rate** - Failed requests or tool executions
- **Success rate** - Successful tool calls

## Architecture Details

### Session Lifecycle

1. **Connection** (`GET /sse`)
   - Client requests SSE connection
   - Durable Object creates unique session ID
   - TransformStream established for bidirectional communication
   - Headers sent: `Content-Type: text/event-stream`, `X-Session-ID`
   - Initial messages: endpoint URL, MCP initialization

2. **Communication** (`POST /sse/message?sessionId={id}`)
   - Client sends MCP JSON-RPC request
   - Durable Object routes to correct session
   - Request processed (initialize, tools/list, tools/call, etc.)
   - Response sent via SSE stream: `data: {json}\n\n`

3. **Heartbeat** (Every 15 seconds)
   - Keeps connection alive with `: heartbeat\n\n` comments
   - Updates session `lastActivity` timestamp
   - Prevents timeout on idle connections

4. **Cleanup** (After 30 minutes inactivity)
   - Background job runs every 5 minutes
   - Removes sessions with `lastActivity > 30 minutes`
   - Closes writers and frees resources

### MCP Tool Implementation

All four tools reuse existing handlers from the main Worker:

- `search_design_knowledge` → `searchWithSupabase()` with formatting
- `search_chunks` → `searchWithSupabase()` with chunk extraction
- `browse_by_category` → `getEntriesByCategory()`
- `get_all_tags` → `getAllTags()`

Tools have access to:
- Supabase client (vector search with pgvector)
- OpenAI embeddings (text-embedding-3-small)
- 188+ curated design system entries
- 761+ content chunks with semantic search

## Updating the Deployment

### Code Changes

1. Make your changes to `src/sse-session.ts` or other files
2. Test locally with `npm run dev`
3. Deploy with `npm run deploy`

### Configuration Changes

1. Update `wrangler.jsonc` as needed
2. Deploy with `npm run deploy`
3. Migrations are automatically applied

### Environment Secret Changes

```bash
wrangler secret put SECRET_NAME
```

Secrets are updated immediately without redeployment.

## Rollback Procedure

If issues arise after deployment:

1. **View deployment history**:
   ```bash
   wrangler deployments list
   ```

2. **Rollback to previous version**:
   ```bash
   wrangler rollback [DEPLOYMENT_ID]
   ```

3. **Verify rollback**:
   ```bash
   curl -N https://your-worker-url.workers.dev/sse
   ```

## Security Considerations

- **CORS**: Currently allows all origins (`*`). Consider restricting for production.
- **Authentication**: No authentication implemented. Consider adding API keys or OAuth.
- **Rate Limiting**: Relies on Cloudflare's built-in rate limiting.
- **Session Security**: Session IDs are UUIDs, but consider additional validation.
- **Secrets**: All secrets stored in Cloudflare's encrypted secret storage.

## Support

For issues specific to:
- **MCP Protocol**: Check [MCP Documentation](https://modelcontextprotocol.io)
- **Cloudflare Workers**: Check [Cloudflare Docs](https://developers.cloudflare.com/workers)
- **Claude Desktop**: Check Anthropic's documentation
- **This Implementation**: Review code in `src/sse-session.ts`

## Summary

You've successfully deployed an MCP server with SSE transport that:
- ✅ Works with Claude Desktop's "Add custom connector" UI
- ✅ Requires only a URL input (no JSON configuration)
- ✅ Maintains persistent sessions with Durable Objects
- ✅ Provides 4 design system knowledge tools
- ✅ Handles 188+ entries with vector search
- ✅ Runs on Cloudflare's global edge network

Your users can now simply enter the SSE URL in Claude Desktop and start asking design system questions!
