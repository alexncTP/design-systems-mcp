/**
 * Core types for Design Systems MCP content
 */

export type SourceType = 'pdf' | 'html' | 'url';
export type Category = 'components' | 'tokens' | 'patterns' | 'workflows' | 'guidelines' | 'general' | 'glossary' | 'accessibility' | 'figma' | 'documentation' | 'workflow' | 'governance' | 'tools' | 'case-studies' | 'foundations';
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Source reliability levels for content authority hierarchy
 */
export type SourceReliabilityLevel = 'gold_standard' | 'authoritative' | 'reference' | 'example' | 'community';
export type TestingStatus = 'production_tested' | 'community_validated' | 'reference_implementation' | 'not_verified';
export type ContentPurpose = 'specification' | 'guidance' | 'learning' | 'example' | 'discussion';

/**
 * Source reliability information for content quality indicators
 */
export interface SourceReliabilityInfo {
  level: SourceReliabilityLevel;
  testingStatus: TestingStatus;
  purpose: ContentPurpose;
  caveats?: string[];
  preferredAlternatives?: string[];
  importantNote?: string;
}

export interface ContentSource {
  type: SourceType;
  location: string;
  ingested_at: string;
}

export interface ChunkMetadata {
  section?: string;
  page?: number;
  heading?: string;
  [key: string]: any; // Allow for additional metadata
}

export interface ContentChunk {
  id: string;
  text: string;
  metadata?: ChunkMetadata;
}

export interface ContentMetadata {
  category: Category;
  tags: string[];
  confidence: Confidence;
  version?: string;
  last_updated: string;
  author?: string;
  system?: string; // e.g., "Material Design", "Carbon", etc.
  /** Source reliability information - added dynamically based on source URL */
  reliability?: SourceReliabilityInfo;
  /** Important contextual note about this content */
  importantNote?: string;
  [key: string]: any; // Allow for additional metadata
}

export interface ContentEntry {
  id: string;
  title: string;
  source: ContentSource;
  content: string;
  chunks: ContentChunk[];
  metadata: ContentMetadata;
}

export interface SearchOptions {
  query?: string;
  category?: Category;
  tags?: string[];
  confidence?: Confidence;
  limit?: number;
}

export interface IngestionOptions {
  source: string;
  type: SourceType;
  metadata?: Partial<ContentMetadata>;
  chunkSize?: number;
  overlapSize?: number;
}
