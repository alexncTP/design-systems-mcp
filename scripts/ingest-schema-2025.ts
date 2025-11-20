#!/usr/bin/env tsx
/**
 * Ingest Schema 2025 announcements from Figma conference
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191),
  });
  return response.data[0].embedding;
}

const schema2025Features = [
  {
    title: 'Figma MCP Server (Model Context Protocol)',
    content: `# Figma MCP Server - Schema 2025 Announcement

**Status**: Available Now (General Availability)
**Category**: Developer Tools, AI Integration, Design Systems

## Overview
The Figma MCP Server is a standardized interface enabling AI agents to interact with Figma design data using the "Model Context Protocol." It bridges design and development by providing design context directly to code generation tools.

## Key Capabilities

1. **Code Generation**: Select a Figma frame and turn it into code for product teams building or iterating features
2. **Design Context Extraction**: Pull variables, components, and layout data into development environments—particularly valuable for design system workflows
3. **Make Resources Integration**: Gather code resources from Make files to provide LLM context during prototype-to-production transitions
4. **Code Connect Consistency**: Leverage your actual components through Code Connect integration to maintain consistency between generated code and production codebases

## Connection Methods

Two deployment options exist:
- **Remote Server**: Hosted Figma endpoint requiring no local infrastructure
- **Desktop Server**: Runs locally through the Figma desktop application

## Use Cases

Applications in:
- New feature development
- Design system management
- Component-based workflows
- Production application scaling
- AI-assisted code generation
- Design-to-code workflows

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://developers.figma.com/docs/figma-mcp-server

## Related Features
- Code Connect UI
- Make Kits
- Design System Workflows`,
    source_location: 'https://developers.figma.com/docs/figma-mcp-server',
    category: 'tools',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'mcp', 'ai-tools', 'code-generation', 'design-systems', 'developer-tools'],
    confidence: 'high'
  },
  {
    title: 'Code Connect UI - Schema 2025',
    content: `# Code Connect UI - Schema 2025 Announcement

**Status**: Available Now (General Availability)
**Category**: Developer Tools, Design Systems, Component Mapping

## Overview
Code Connect UI is a feature within Figma's developer tools that facilitates mapping design components to their corresponding code implementations. The tool bridges the gap between design systems and development by creating explicit relationships between Figma library components and codebase elements.

## Requirements
- Dev or Full seat on Organization or Enterprise plans
- A Figma library file containing published design components
- Access to Dev Mode in Figma

## Core Functionality

**Component Mapping**: Users can connect published components from Figma design libraries to code paths in their repository. The system accepts either manual entries or GitHub-integrated lookups.

**Manual Connection Process**:
- Open a library file in Figma
- Switch to Dev Mode
- Select "Library → Connect components to code" from the dropdown
- Enter component paths (e.g., src/components/Button.tsx) and optional component names

## Integration Features

**GitHub Integration** (Optional):
The system offers optional GitHub connectivity that enables autocomplete functionality for file paths and allows browsing/searching components directly from repositories.

**MCP Server Integration**: These mappings enhance the Figma MCP server by giving AI agents direct references to your code, enabling more accurate implementation guidance.

## Advanced Capabilities

**Custom AI Instructions**: Users can add context-specific instructions for AI code generation, including:
- Prop patterns and configuration requirements
- Accessibility considerations
- Component usage variations
- Team-specific conventions

**Code Preview**: The UI includes functionality to preview AI-generated code snippets based on current component properties and custom instructions, allowing validation of mappings before deployment.

## Design System Applications
Mappings improve AI-generated code accuracy when working with design systems, particularly for frames containing multiple component variants.

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://developers.figma.com/docs/code-connect/code-connect-ui-setup/

## Related Features
- Figma MCP Server
- Code Connect
- Design System Workflows
- Dev Mode`,
    source_location: 'https://developers.figma.com/docs/code-connect/code-connect-ui-setup/',
    category: 'tools',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'code-connect', 'component-mapping', 'design-systems', 'developer-tools'],
    confidence: 'high'
  },
  {
    title: 'Variable Mode Limit Increase - Schema 2025',
    content: `# Variable Mode Limit Increase - Schema 2025 Announcement

**Status**: Available Now
**Category**: Design Tokens, Variables, Design Systems

## Overview
Figma has increased the limit for variable modes from 40 to 1,000 modes per variable collection, announced at Schema 2025 conference.

## Key Details

**Previous Limit**: 40 modes per variable collection
**New Limit**: 1,000 modes per variable collection

## Impact on Design Systems

This dramatic increase enables:
- **Complex Theme Systems**: Support for dozens or hundreds of theme variations
- **Multi-Brand Systems**: Design systems serving multiple brands or products
- **Advanced Localization**: Extensive language and regional variations
- **Complex State Management**: More granular state variations in components
- **Enterprise Scale**: Support for large organizations with many sub-brands

## Use Cases

1. **Multi-Brand Design Systems**: Organizations managing 50+ brand variations
2. **Global Products**: Products supporting 100+ language/locale combinations
3. **Advanced Theming**: Complex theme hierarchies with numerous variations
4. **White-Label Solutions**: Products serving many customizable client brands
5. **Component States**: Detailed state management across many contexts

## Design Token Integration

The increased limit aligns with design token best practices for:
- Semantic token layers
- Context-specific tokens
- Theme variation management
- Brand customization workflows

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Variables
- Design Tokens
- Theming
- Multi-Brand Systems`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'variables',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'variables', 'design-tokens', 'theming', 'design-systems', 'modes'],
    confidence: 'high'
  },
  {
    title: 'Extended Collections - Schema 2025',
    content: `# Extended Collections - Schema 2025 Announcement

**Status**: Coming Soon (November 2025)
**Category**: Variables, Design Tokens, Design Systems

## Overview
Extended Collections is an upcoming feature announced at Schema 2025 that will enhance Figma's variable collections system, expected to launch in November 2025.

## Expected Benefits

While full details are pending the November release, Extended Collections is anticipated to provide:
- Enhanced variable collection management
- Improved organization for large-scale design systems
- Better workflows for complex design token systems
- Expanded capabilities for design system teams

## Timeline
Expected launch: November 2025

## Design System Impact

This feature is specifically targeted at design systems teams and is expected to improve:
- Variable organization at scale
- Design token management
- Multi-team collaboration
- System governance

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Variables
- Design Tokens
- Variable Mode Limit Increase
- Design System Workflows`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'variables',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'variables', 'design-tokens', 'design-systems', 'coming-soon'],
    confidence: 'medium'
  },
  {
    title: 'Import npm Packages into Figma Make - Schema 2025',
    content: `# Import npm Packages into Figma Make - Schema 2025 Announcement

**Status**: Coming Soon (December 2025)
**Category**: Make, Developer Tools, Prototyping

## Overview
Announced at Schema 2025, this upcoming feature will enable direct import of npm packages into Figma Make, bridging the gap between design prototypes and production code. Expected launch: December 2025.

## Expected Capabilities

The feature is anticipated to allow:
- Direct npm package imports into Make projects
- Use of production dependencies in prototypes
- Better prototype-to-production workflows
- Leveraging existing component libraries

## Design System Benefits

For design systems teams, this feature should enable:
- Prototyping with actual production components
- Testing design system packages in Figma
- Faster validation of component behavior
- Reduced code duplication between prototype and production

## Use Cases

1. **Component Library Testing**: Test actual npm packages in design prototypes
2. **Production Validation**: Validate designs using real production code
3. **Design System Prototyping**: Use published design system packages
4. **Integration Testing**: Test component integration before development

## Timeline
Expected launch: December 2025

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Figma Make
- Make Kits
- Code Connect
- Design System Workflows`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'tools',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'make', 'npm', 'developer-tools', 'prototyping', 'design-systems', 'coming-soon'],
    confidence: 'medium'
  },
  {
    title: 'Make Kits - Schema 2025',
    content: `# Make Kits - Schema 2025 Announcement

**Status**: Early Access
**Category**: Make, Component Libraries, Design Systems

## Overview
Make Kits is a new feature in Figma Make announced at Schema 2025, currently available in early access. Make Kits provide pre-built component libraries and templates for rapid prototyping and development within Figma Make.

## Key Features

Make Kits are expected to offer:
- Pre-built component collections for Make
- Design system integration
- Rapid prototyping capabilities
- Production-ready code patterns

## Design System Integration

Make Kits complement design systems by:
- Providing ready-to-use component kits
- Accelerating prototype development
- Maintaining consistency with design systems
- Bridging design and code implementation

## Early Access

Currently available in early access to select users and organizations. Full general availability details to be announced.

## Use Cases

1. **Rapid Prototyping**: Quick prototype creation with pre-built components
2. **Design System Starters**: Jumpstart design system implementation
3. **Component Patterns**: Learn component patterns and best practices
4. **Production Templates**: Use production-ready patterns

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Figma Make
- Import npm Packages
- Design System Workflows
- Code Connect`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'tools',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'make', 'component-libraries', 'design-systems', 'early-access', 'prototyping'],
    confidence: 'medium'
  },
  {
    title: 'Slots - Schema 2025',
    content: `# Slots - Schema 2025 Announcement

**Status**: Early Access
**Category**: Components, Design Systems, Advanced Composition

## Overview
Slots is a new component composition feature announced at Schema 2025, currently in early access. Slots enable more flexible component architecture by allowing designated areas within components where other components or content can be inserted.

## Expected Capabilities

Slots are anticipated to provide:
- Named insertion points within components
- Flexible component composition patterns
- Better component reusability
- Advanced layout systems

## Design System Benefits

For design systems, Slots enable:
- **Composition Patterns**: Create components that accept other components as children
- **Layout Components**: Build flexible layout systems with slot-based architecture
- **Component Variants**: Reduce variant proliferation by using composition
- **Atomic Design**: Better support for atomic design methodology

## Component Architecture

Slots allow for patterns like:
- Card components with header/body/footer slots
- Layout components with multiple content areas
- Navigation components with configurable sections
- Container components with flexible content insertion

## Early Access

Currently available in early access. Full details and capabilities to be revealed with general availability.

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Components
- Variants
- Auto Layout
- Design System Workflows`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'components',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'components', 'composition', 'design-systems', 'early-access', 'slots'],
    confidence: 'medium'
  },
  {
    title: 'Check Designs - Schema 2025',
    content: `# Check Designs - Schema 2025 Announcement

**Status**: Early Access
**Category**: Quality Assurance, Design Systems, Validation

## Overview
Check Designs is a new validation and quality assurance feature announced at Schema 2025, currently in early access. It provides automated checking and validation of designs against design system standards and best practices.

## Expected Features

Check Designs is anticipated to offer:
- Automated design validation
- Design system compliance checking
- Accessibility validation
- Design pattern enforcement

## Design System Governance

For design systems, Check Designs enables:
- **Automated Compliance**: Check designs against design system rules
- **Consistency Enforcement**: Validate proper use of design tokens and components
- **Accessibility Validation**: Identify accessibility issues before handoff
- **Quality Gates**: Establish quality standards for design deliverables

## Use Cases

1. **Design System Compliance**: Validate proper component and token usage
2. **Accessibility Audits**: Check WCAG compliance and accessibility standards
3. **Design Reviews**: Automate part of the design review process
4. **Quality Assurance**: Catch issues before developer handoff

## Early Access

Currently available in early access. Full capabilities and detailed documentation to be released with general availability.

## Announced At
Schema 2025 Conference by Figma

## Documentation
https://help.figma.com/hc/en-us/articles/35794667554839-What-s-new-from-Schema-2025

## Related Features
- Design Systems
- Variables
- Components
- Dev Mode
- Quality Assurance`,
    source_location: 'https://help.figma.com/hc/en-us/articles/35794667554839',
    category: 'quality',
    system_name: 'Figma',
    tags: ['schema-2025', 'figma', 'validation', 'quality-assurance', 'design-systems', 'early-access', 'governance'],
    confidence: 'medium'
  }
];

async function ingestSchema2025Features() {
  console.log('🚀 Starting Schema 2025 feature ingestion...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const feature of schema2025Features) {
    try {
      console.log(`\n📦 Processing: ${feature.title}`);

      // Generate embedding
      console.log('  🧮 Generating embedding...');
      const embedding = await generateEmbedding(feature.content);

      // Prepare entry
      const entry = {
        id: uuidv4(),
        title: feature.title,
        content: feature.content,
        source_type: 'documentation',
        source_location: feature.source_location,
        category: feature.category,
        system_name: feature.system_name,
        tags: feature.tags,
        confidence: feature.confidence,
        embedding: JSON.stringify(embedding),
        metadata: {
          conference: 'Schema 2025',
          announcement_date: '2025',
          ingested_via: 'schema-2025-script'
        }
      };

      // Insert into database
      console.log('  💾 Saving to database...');
      const { error } = await supabase
        .from('content_entries')
        .insert([entry]);

      if (error) {
        console.error('  ❌ Error:', error.message);
        errorCount++;
        continue;
      }

      console.log('  ✅ Successfully ingested!');
      successCount++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`  ❌ Failed to ingest ${feature.title}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n\n📊 Ingestion Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📦 Total: ${schema2025Features.length}`);

  // Test vector search
  console.log('\n🔍 Testing vector search with "Figma MCP Server"...');
  const testQuery = 'Figma MCP Server';
  const queryEmbedding = await generateEmbedding(testQuery);

  const { data: searchResults, error: searchError } = await supabase.rpc('search_content', {
    query_embedding: queryEmbedding,
    query_text: testQuery,
    match_threshold: 0.15,
    match_count: 5
  });

  if (searchError) {
    console.error('❌ Search error:', searchError);
  } else {
    console.log(`\n✅ Found ${searchResults.length} results:`);
    searchResults.slice(0, 3).forEach((result: any, idx: number) => {
      console.log(`  ${idx + 1}. ${result.title} (similarity: ${result.rank?.toFixed(4)})`);
    });
  }
}

ingestSchema2025Features().catch(console.error);
