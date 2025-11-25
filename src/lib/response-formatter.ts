/**
 * Natural language response formatting for search results
 */

import type { ContentEntry, ContentChunk } from '../../types/content';
import { formatSourceReference } from './source-formatter';

interface SearchResult {
  entry: ContentEntry;
  chunk: ContentChunk;
  score: number;
}

/**
 * Format search results in a more natural, conversational way
 * instead of always using bullet points
 */
export function formatNaturalResponse(
  results: SearchResult[],
  query: string
): string {
  if (results.length === 0) {
    return "I couldn't find specific information about that in the knowledge base.";
  }

  // Group results by source
  const sourceGroups = new Map<string, SearchResult[]>();
  results.forEach(result => {
    const key = result.entry.id;
    if (!sourceGroups.has(key)) {
      sourceGroups.set(key, []);
    }
    sourceGroups.get(key)!.push(result);
  });

  // Choose formatting based on result patterns
  const formatStyle = determineFormatStyle(results, query);
  
  switch (formatStyle) {
    case 'narrative':
      return formatNarrativeResponse(results, sourceGroups);
    case 'definition':
      return formatDefinitionResponse(results, sourceGroups);
    case 'comparison':
      return formatComparisonResponse(results, sourceGroups);
    case 'technical':
      return formatTechnicalResponse(results, sourceGroups);
    default:
      return formatMixedResponse(results, sourceGroups);
  }
}

/**
 * Determine the best format style based on query and results
 */
function determineFormatStyle(results: SearchResult[], query: string): string {
  const queryLower = query.toLowerCase();
  
  // Definition queries
  if (queryLower.includes('what is') || queryLower.includes('what are') || 
      queryLower.includes('define') || queryLower.includes('meaning')) {
    return 'definition';
  }
  
  // Comparison queries
  if (queryLower.includes('difference') || queryLower.includes('compare') || 
      queryLower.includes('vs') || queryLower.includes('versus')) {
    return 'comparison';
  }
  
  // Technical implementation queries
  if (queryLower.includes('how to') || queryLower.includes('implement') || 
      queryLower.includes('create') || queryLower.includes('build')) {
    return 'technical';
  }
  
  // General narrative for overview questions
  if (queryLower.includes('overview') || queryLower.includes('explain') || 
      queryLower.includes('describe')) {
    return 'narrative';
  }
  
  return 'mixed';
}

/**
 * Format as a flowing narrative
 */
function formatNarrativeResponse(
  results: SearchResult[],
  sourceGroups: Map<string, SearchResult[]>
): string {
  const parts: string[] = [];
  
  // Start with the most relevant result as introduction
  const topResult = results[0];
  const { displayName, url } = formatSourceReference(topResult.entry);
  
  parts.push(`According to ${formatSourceLink(displayName, url)}, ${topResult.chunk.text.trim()}`);
  
  // Add supporting information from other sources
  if (results.length > 1) {
    const additionalSources = Array.from(sourceGroups.keys()).slice(1, 3);
    
    if (additionalSources.length > 0) {
      parts.push('\n\nThis is further supported by other sources:');
      
      additionalSources.forEach(sourceId => {
        const sourceResults = sourceGroups.get(sourceId)!;
        const firstResult = sourceResults[0];
        const { displayName, url } = formatSourceReference(firstResult.entry);
        
        parts.push(`\n${formatSourceLink(displayName, url)} notes that "${firstResult.chunk.text.substring(0, 200)}..."`);
      });
    }
  }
  
  return parts.join('\n');
}

/**
 * Format as a clear definition with examples
 */
function formatDefinitionResponse(
  results: SearchResult[],
  sourceGroups: Map<string, SearchResult[]>
): string {
  const parts: string[] = [];
  
  // Lead with the clearest definition
  const definitionResult = results.find(r => 
    r.chunk.text.toLowerCase().includes('is a') || 
    r.chunk.text.toLowerCase().includes('are a') ||
    r.chunk.text.toLowerCase().includes('refers to')
  ) || results[0];
  
  const { displayName, url } = formatSourceReference(definitionResult.entry);
  
  parts.push(`**Definition**: ${definitionResult.chunk.text.trim()}`);
  parts.push(`\n*Source: ${formatSourceLink(displayName, url)}*`);
  
  // Add key characteristics if available
  const characteristics = results.slice(1, 4).filter(r => r.entry.id !== definitionResult.entry.id);
  
  if (characteristics.length > 0) {
    parts.push('\n\n**Key Characteristics:**');
    characteristics.forEach(result => {
      const point = extractKeyPoint(result.chunk.text);
      if (point) {
        parts.push(`• ${point}`);
      }
    });
  }
  
  return parts.join('\n');
}

/**
 * Format as a comparison table or structured comparison
 */
function formatComparisonResponse(
  results: SearchResult[],
  sourceGroups: Map<string, SearchResult[]>
): string {
  const parts: string[] = [];
  
  parts.push('**Comparison Overview:**\n');
  
  // Extract comparison points
  results.slice(0, 5).forEach(result => {
    const { displayName, url } = formatSourceReference(result.entry);
    const point = extractKeyPoint(result.chunk.text);
    
    if (point) {
      parts.push(`• ${point} (${formatSourceLink(displayName, url)})`);
    }
  });
  
  return parts.join('\n');
}

/**
 * Format as technical implementation steps
 */
function formatTechnicalResponse(
  results: SearchResult[],
  sourceGroups: Map<string, SearchResult[]>
): string {
  const parts: string[] = [];
  
  parts.push('**Implementation Guide:**\n');
  
  // Look for step-by-step or procedural content
  const steps = extractImplementationSteps(results);
  
  if (steps.length > 0) {
    steps.forEach((step, index) => {
      parts.push(`${index + 1}. ${step.text}`);
      if (step.source) {
        parts.push(`   *Reference: ${step.source}*`);
      }
    });
  } else {
    // Fallback to key points
    results.slice(0, 5).forEach(result => {
      const { displayName, url } = formatSourceReference(result.entry);
      const point = extractKeyPoint(result.chunk.text);
      
      if (point) {
        parts.push(`• ${point}`);
        parts.push(`  *Source: ${formatSourceLink(displayName, url)}*\n`);
      }
    });
  }
  
  return parts.join('\n');
}

/**
 * Format with mixed styles for general queries
 */
function formatMixedResponse(
  results: SearchResult[],
  sourceGroups: Map<string, SearchResult[]>
): string {
  const parts: string[] = [];
  
  // Group by themes if possible
  const themes = identifyThemes(results);
  
  if (themes.size > 1) {
    themes.forEach((themeResults, theme) => {
      parts.push(`**${theme}:**`);
      
      themeResults.slice(0, 2).forEach(result => {
        const { displayName, url } = formatSourceReference(result.entry);
        const point = extractKeyPoint(result.chunk.text);
        
        if (point) {
          parts.push(`${point} (via ${formatSourceLink(displayName, url)})\n`);
        }
      });
    });
  } else {
    // Simple paragraph format
    results.slice(0, 4).forEach((result, index) => {
      const { displayName, url } = formatSourceReference(result.entry);
      
      if (index === 0) {
        parts.push(`${result.chunk.text.trim()}`);
        parts.push(`\n*Source: ${formatSourceLink(displayName, url)}*\n`);
      } else {
        const point = extractKeyPoint(result.chunk.text);
        if (point) {
          parts.push(`Additionally, ${formatSourceLink(displayName, url)} mentions: "${point}"\n`);
        }
      }
    });
  }
  
  return parts.join('\n');
}

/**
 * Helper: Format source link
 */
function formatSourceLink(name: string, url: string | null): string {
  if (url) {
    return `[${name}](${url})`;
  }
  return name;
}

/**
 * Helper: Extract key point from chunk text
 */
function extractKeyPoint(text: string): string {
  // Remove quotes and clean up
  let cleaned = text.replace(/^["']|["']$/g, '').trim();
  
  // Truncate if too long
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }
  
  return cleaned;
}

/**
 * Helper: Extract implementation steps
 */
function extractImplementationSteps(results: SearchResult[]): Array<{text: string; source: string}> {
  const steps: Array<{text: string; source: string}> = [];
  
  results.forEach(result => {
    const { displayName, url } = formatSourceReference(result.entry);
    const source = formatSourceLink(displayName, url);
    
    // Look for numbered steps or clear procedures
    const lines = result.chunk.text.split('\n');
    lines.forEach(line => {
      if (/^\d+\./.test(line.trim()) || /^[•\-*]/.test(line.trim())) {
        steps.push({
          text: line.replace(/^[\d.\-*•]\s*/, '').trim(),
          source
        });
      }
    });
  });
  
  return steps.slice(0, 7); // Limit to 7 steps
}

/**
 * Helper: Identify themes in results
 */
function identifyThemes(results: SearchResult[]): Map<string, SearchResult[]> {
  const themes = new Map<string, SearchResult[]>();
  
  // Simple theme detection based on keywords
  const themeKeywords = {
    'Components': ['component', 'button', 'form', 'input', 'ui'],
    'Design Tokens': ['token', 'color', 'spacing', 'typography', 'variable'],
    'Architecture': ['structure', 'organize', 'architecture', 'system', 'pattern'],
    'Process': ['workflow', 'process', 'team', 'governance', 'maintain'],
    'Implementation': ['implement', 'build', 'create', 'develop', 'code']
  };
  
  results.forEach(result => {
    const textLower = result.chunk.text.toLowerCase();
    let assigned = false;
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        if (!themes.has(theme)) {
          themes.set(theme, []);
        }
        themes.get(theme)!.push(result);
        assigned = true;
        break;
      }
    }
    
    if (!assigned) {
      if (!themes.has('General Insights')) {
        themes.set('General Insights', []);
      }
      themes.get('General Insights')!.push(result);
    }
  });
  
  return themes;
}