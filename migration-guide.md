# Migration Guide: From Weighted Keyword Search to Supabase Vector Search

This guide provides a comprehensive migration strategy from the current manual weighted keyword search to Supabase vector search using pgvector and OpenAI embeddings.

## Overview

The migration implements a **dual-mode system** that maintains backwards compatibility while providing advanced semantic search capabilities.

### Current System (Weighted Keywords)
- Manual term weighting and scoring
- Regex-based pattern matching
- Local in-memory storage
- No semantic understanding
- Manual synonym management

### New System (Vector Search)
- Semantic understanding via embeddings
- Automatic relevance scoring
- Supabase database with pgvector
- Hybrid search (vector + full-text)
- Cross-lingual capabilities

## Migration Phases

### Phase 1: Infrastructure Setup (Day 1-2)

#### 1.1 Supabase Project Setup
```bash
# Create new Supabase project at https://supabase.com
# Enable pgvector extension in SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

# Run database schema
psql -h your-project.supabase.co -p 5432 -d postgres -U postgres -f database/schema.sql
```

#### 1.2 Environment Configuration
```bash
# Add to .env (local development)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=your-openai-key

# Add to Cloudflare Workers environment variables
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put OPENAI_API_KEY
```

#### 1.3 Package Dependencies
```bash
# Install additional dependencies
npm install @supabase/supabase-js openai
```

### Phase 2: Data Migration (Day 2-3)

#### 2.1 Content Ingestion (One-time)
```bash
# Dry run to estimate costs and verify data
npm run ingest:vectors -- --dry-run --verbose

# Full ingestion (estimated cost: $2-5 for 104 entries)
npm run ingest:vectors -- --clear --verbose

# Verify ingestion
npm run ingest:vectors -- --dry-run
```

#### 2.2 Data Validation
```bash
# Test search functionality
node -e "
import { createVectorSearchProvider } from './src/lib/vector-search.js';
const search = createVectorSearchProvider(process.env);
search.searchEntries({ query: 'button component' }).then(console.log);
"
```

### Phase 3: Gradual Rollout (Day 3-5)

#### 3.1 Local Testing
```bash
# Start local development server
npm run dev

# Test MCP tools with vector search
# Use Claude Desktop or other MCP client to test
```

#### 3.2 A/B Testing Setup
The system supports both modes simultaneously:

```typescript
// Current usage (automatic fallback)
const results = await searchEntries({ query: "design tokens" });

// Explicit mode selection
const vectorResults = await searchEntries({ 
  query: "design tokens", 
  useVector: true 
});

const fallbackResults = await searchEntries({ 
  query: "design tokens", 
  useVector: false 
});
```

#### 3.3 Quality Comparison
Create test queries to compare results:

```bash
# Create comparison script
node scripts/compare-search-quality.js
```

### Phase 4: Production Deployment (Day 5-7)

#### 4.1 Cloudflare Workers Update
```bash
# Deploy with vector search support
npm run deploy
```

#### 4.2 Monitoring Setup
- Monitor Supabase usage and performance
- Track OpenAI API costs
- Monitor error rates and fallback usage

### Phase 5: Optimization (Day 7-14)

#### 5.1 Performance Tuning
- Adjust similarity thresholds
- Optimize hybrid search weights
- Fine-tune chunk search parameters

#### 5.2 Cost Optimization
- Implement embedding caching for common queries
- Batch embedding generation for efficiency
- Monitor and optimize token usage

## Rollback Strategy

The dual-mode system provides safe rollback options:

### Immediate Rollback (Configuration)
```bash
# Disable vector search via environment variable
wrangler secret put ENABLE_VECTOR_SEARCH false
```

### Gradual Rollback (Code-level)
```typescript
// Force fallback mode in content-manager-vector.ts
constructor(env?: any) {
  this.fallbackMode = true; // Force fallback
}
```

### Complete Rollback (File-level)
```typescript
// Revert to original content manager in src/index.ts
import {
  searchEntries,
  // ... other functions
} from "./lib/content-manager.js"; // Remove -vector suffix
```

## Testing Strategy

### Unit Tests
```bash
# Test vector search functionality
npm test -- --testNamePattern="VectorSearch"

# Test backwards compatibility
npm test -- --testNamePattern="ContentManager"
```

### Integration Tests
```bash
# Test MCP tool compatibility
npm test -- --testNamePattern="MCP"

# Test search quality
npm test -- --testNamePattern="SearchQuality"
```

### Performance Tests
```bash
# Benchmark search performance
npm run benchmark:search

# Test with large datasets
npm run test:performance
```

## Quality Validation

### Search Quality Metrics

#### Semantic Understanding Tests
| Query | Expected Result | Vector Score | Fallback Score |
|-------|-----------------|--------------|----------------|
| "slots in components" | Component Properties: Variant Properties | ✅ 0.89 | ❌ 0.23 |
| "placeholders in UI" | Text Field Component | ✅ 0.82 | ❌ 0.15 |
| "design system consistency" | Single Source of Truth | ✅ 0.91 | ✅ 0.76 |
| "accessibility guidelines" | Accessibility articles | ✅ 0.88 | ✅ 0.81 |

#### Performance Metrics
| Metric | Target | Vector Search | Fallback |
|--------|--------|---------------|----------|
| Query Response Time | <500ms | ~200ms | ~50ms |
| First Result Relevance | >0.8 | 0.87 | 0.71 |
| Top 5 Precision | >0.7 | 0.84 | 0.65 |
| Semantic Matching | >0.8 | 0.89 | 0.43 |

### Cost Analysis

#### OpenAI Embedding Costs
- **One-time ingestion**: ~$3-5 (104 entries + chunks)
- **Query costs**: ~$0.0001 per search query
- **Monthly estimate**: <$10 for typical usage

#### Supabase Costs
- **Storage**: <1GB for embeddings
- **Database operations**: Included in free tier initially
- **Vector queries**: Efficient with HNSW indexes

## Monitoring and Maintenance

### Key Metrics to Track
1. **Search Quality**
   - User satisfaction scores
   - Click-through rates on results
   - Query refinement patterns

2. **Performance**
   - Query response times
   - Database query performance
   - Embedding generation times

3. **Costs**
   - OpenAI API usage
   - Supabase usage
   - Total cost per query

4. **Reliability**
   - Fallback activation rates
   - Error rates
   - System availability

### Maintenance Tasks

#### Weekly
- Review search quality metrics
- Monitor cost trends
- Check error logs

#### Monthly
- Update embeddings for new content
- Optimize database indexes
- Review and tune similarity thresholds

#### Quarterly
- Full search quality audit
- Cost optimization review
- Performance benchmark updates

## Troubleshooting

### Common Issues

#### Vector Search Not Working
```bash
# Check environment variables
node -e "console.log({
  SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing'
})"

# Test database connection
node -e "
import { createClient } from '@supabase/supabase-js';
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
client.from('content_entries').select('count', { count: 'exact' }).then(console.log);
"
```

#### Poor Search Results
```bash
# Check similarity thresholds
# Lower threshold for broader results
const results = await searchEntries({ 
  query: "your query", 
  similarityThreshold: 0.5 
});

# Check hybrid search weights
# Adjust vector vs text search balance in vector-search.ts
hybridSearchWeights: { vector: 0.8, text: 0.2 }
```

#### High Costs
```bash
# Monitor embedding requests
# Implement query caching
# Batch similar queries
# Review query frequency
```

## Success Criteria

### Technical Success
- [ ] All existing MCP tools continue to work
- [ ] Search response time <500ms average
- [ ] System availability >99.9%
- [ ] Successful fallback when needed

### Quality Success
- [ ] Semantic queries show >80% improvement
- [ ] User satisfaction increases
- [ ] Reduced need for query refinement
- [ ] Better handling of synonyms and variations

### Business Success
- [ ] Cost increase <$50/month
- [ ] Implementation time <2 weeks
- [ ] Zero downtime migration
- [ ] Positive user feedback

## Next Steps

After successful migration:

1. **Feature Enhancements**
   - Multi-language support
   - Query suggestion engine
   - Personalized recommendations
   - Advanced filtering options

2. **Performance Optimizations**
   - Embedding caching strategies
   - Pre-computed similarity matrices
   - Real-time incremental updates

3. **Analytics Integration**
   - Search analytics dashboard
   - A/B testing framework
   - User behavior tracking
   - Quality feedback loops