#!/usr/bin/env bun
/**
 * Content Cleanup Script for Design Systems MCP
 * 
 * This script analyzes and cleans JSON content entries to:
 * 1. Remove non-design-system content
 * 2. Clean up redundant navigation/footer content
 * 3. Fix HTML artifacts and formatting issues
 * 4. Generate a quality report
 */

import * as fs from 'fs';
import * as path from 'path';

interface ContentEntry {
  id: string;
  title: string;
  source: {
    type: string;
    location: string;
    ingested_at: string;
  };
  content: string;
  chunks: Array<{
    id: string;
    text: string;
    metadata: any;
  }>;
  metadata: {
    category: string;
    tags: string[];
    confidence: string;
    last_updated: string;
    source_url: string;
  };
}

interface CleanupReport {
  totalFiles: number;
  filesRemoved: string[];
  filesCleaned: string[];
  filesClean: string[];
  qualityScore: number;
  issues: {
    critical: string[];
    quality: string[];
  };
  stats: {
    contentRelevance: number;
    contentCleanliness: number;
    technicalAccuracy: number;
    completeness: number;
  };
}

class ContentCleaner {
  private contentDir = path.join(process.cwd(), 'content', 'entries');
  private backupDir = path.join(process.cwd(), 'content', 'entries-backup');
  private report: CleanupReport = {
    totalFiles: 0,
    filesRemoved: [],
    filesCleaned: [],
    filesClean: [],
    qualityScore: 0,
    issues: {
      critical: [],
      quality: []
    },
    stats: {
      contentRelevance: 0,
      contentCleanliness: 0,
      technicalAccuracy: 0,
      completeness: 0
    }
  };

  // Files that should be completely removed
  private blacklistedFiles = [
    'advertisement',
    'biweekly-digest',
    'subscribe',
    'privacy-policy',
    'cookie-policy',
    'terms-of-service'
  ];

  // Patterns that indicate non-design-system content
  private blacklistedPatterns = [
    /\$\d+\/month/i,  // Pricing
    /subscribe\s+for\s+free/i,
    /marketing\s+and\s+account-related\s+emails/i,
    /you\s+can\s+unsubscribe/i,
    /privacy\s+policy.*cookie\s+policy/i,
    /promote\s+your\s+product\s+or\s+service/i,
    /minimum\s+advertising\s+placement/i
  ];

  // Navigation/footer patterns to remove
  private navigationPatterns = [
    /Design\s+\.surf\s+©\s+Dzeya\s+OÜ\.?\s+All\s+rights\s+reserved[\s\S]*/,
    /\[X\s+\(Twitter\)\][\s\S]*\[Share\s+feedback\]/,
    /##\s+Links\s+\[Systems\d+\][\s\S]*/,
    /\[DesignSystems\.surf\][\s\S]*\[Share\s+feedback\]/,
    /Cookie\s+Settings[\s\S]*All\s+rights\s+reserved/,
    /\[AccordionAccordionAccordion\]/g,  // Component link repetition
    /\[([A-Za-z\s]+)\1\1\]/g  // General triple repetition pattern
  ];

  // HTML artifacts to clean
  private htmlArtifacts = [
    /class="[^"]+"/g,
    /aria-hidden="[^"]+"/g,
    /\s*\)\"\s*/g,
    /\s*>\s*>\s*/g,
    /\s*\"\s*>\s*\"\s*>/g
  ];

  async run(dryRun = false): Promise<void> {
    console.log('🔍 Starting content cleanup analysis...\n');

    // Create backup directory
    if (!dryRun && !fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Created backup directory\n');
    }

    // Get all JSON files
    const files = fs.readdirSync(this.contentDir)
      .filter(f => f.endsWith('.json'));
    
    this.report.totalFiles = files.length;
    console.log(`📊 Found ${files.length} content files to analyze\n`);

    // Process each file
    for (const filename of files) {
      await this.processFile(filename, dryRun);
    }

    // Calculate final scores
    this.calculateQualityScore();

    // Print report
    this.printReport();

    // Save report
    if (!dryRun) {
      this.saveReport();
    }
  }

  private async processFile(filename: string, dryRun: boolean): Promise<void> {
    const filepath = path.join(this.contentDir, filename);
    
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const entry: ContentEntry = JSON.parse(content);
      
      // Check if file should be removed
      if (this.shouldRemoveFile(entry, filename)) {
        this.report.filesRemoved.push(filename);
        this.report.issues.critical.push(`${filename}: Non-design-system content`);
        
        if (!dryRun) {
          // Backup and remove
          fs.copyFileSync(filepath, path.join(this.backupDir, filename));
          fs.unlinkSync(filepath);
          console.log(`❌ Removed: ${filename}`);
        }
        return;
      }

      // Check if file needs cleaning
      const cleanedEntry = this.cleanContent(entry);
      const wasChanged = JSON.stringify(entry) !== JSON.stringify(cleanedEntry);

      if (wasChanged) {
        this.report.filesCleaned.push(filename);
        
        if (!dryRun) {
          // Backup and save cleaned version
          fs.copyFileSync(filepath, path.join(this.backupDir, filename));
          fs.writeFileSync(filepath, JSON.stringify(cleanedEntry, null, 2));
          console.log(`✨ Cleaned: ${filename}`);
        }
      } else {
        const quality = this.assessContentQuality(entry);
        if (quality.score > 80) {
          this.report.filesClean.push(filename);
        } else {
          this.report.issues.quality.push(`${filename}: Quality score ${quality.score}%`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
      this.report.issues.critical.push(`${filename}: Processing error`);
    }
  }

  private shouldRemoveFile(entry: ContentEntry, filename: string): boolean {
    // Check filename
    for (const blacklisted of this.blacklistedFiles) {
      if (filename.toLowerCase().includes(blacklisted)) {
        return true;
      }
    }

    // Check content
    const contentToCheck = entry.content + ' ' + entry.title;
    for (const pattern of this.blacklistedPatterns) {
      if (pattern.test(contentToCheck)) {
        return true;
      }
    }

    // Check if it's primarily advertising or subscription content
    const lowerContent = contentToCheck.toLowerCase();
    const adIndicators = [
      'advertisement', 'pricing', 'subscribe', 'newsletter',
      'privacy policy', 'cookie policy', 'terms of service'
    ];
    
    const adCount = adIndicators.filter(term => lowerContent.includes(term)).length;
    if (adCount >= 3) {
      return true;
    }

    return false;
  }

  private cleanContent(entry: ContentEntry): ContentEntry {
    const cleaned = { ...entry };
    
    // Clean main content
    let content = cleaned.content;
    
    // Remove navigation patterns
    for (const pattern of this.navigationPatterns) {
      content = content.replace(pattern, '');
    }
    
    // Remove HTML artifacts
    for (const artifact of this.htmlArtifacts) {
      content = content.replace(artifact, '');
    }
    
    // Fix component link repetition
    content = content.replace(/\[([A-Za-z\s]+)\1+\]/g, '[$1]');
    
    // Trim excessive whitespace
    content = content.replace(/\n{3,}/g, '\n\n').trim();
    
    cleaned.content = content;
    
    // Clean chunks
    if (cleaned.chunks) {
      cleaned.chunks = cleaned.chunks.map(chunk => ({
        ...chunk,
        text: this.cleanChunkText(chunk.text)
      }));
    }
    
    return cleaned;
  }

  private cleanChunkText(text: string): string {
    let cleaned = text;
    
    // Apply same cleaning as main content
    for (const pattern of this.navigationPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }
    
    for (const artifact of this.htmlArtifacts) {
      cleaned = cleaned.replace(artifact, '');
    }
    
    cleaned = cleaned.replace(/\[([A-Za-z\s]+)\1+\]/g, '[$1]');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    
    return cleaned;
  }

  private assessContentQuality(entry: ContentEntry): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;
    
    // Check for design system relevance
    const designSystemTerms = [
      'component', 'design system', 'pattern', 'token', 'accessibility',
      'typography', 'color', 'spacing', 'layout', 'interface', 'ui', 'ux'
    ];
    
    const lowerContent = entry.content.toLowerCase();
    const relevantTermCount = designSystemTerms.filter(term => lowerContent.includes(term)).length;
    
    if (relevantTermCount < 3) {
      score -= 20;
      issues.push('Low design system relevance');
    }
    
    // Check for excessive navigation
    const navMatch = entry.content.match(/\[.*\]\(.*\)/g);
    if (navMatch && navMatch.length > 50) {
      score -= 15;
      issues.push('Excessive navigation links');
    }
    
    // Check for HTML artifacts
    if (entry.content.includes('class=') || entry.content.includes('aria-')) {
      score -= 10;
      issues.push('HTML artifacts present');
    }
    
    // Check content length
    if (entry.content.length < 200) {
      score -= 10;
      issues.push('Content too short');
    }
    
    return { score: Math.max(0, score), issues };
  }

  private calculateQualityScore(): void {
    const totalFiles = this.report.totalFiles;
    const removedFiles = this.report.filesRemoved.length;
    const cleanedFiles = this.report.filesCleaned.length;
    const cleanFiles = this.report.filesClean.length;
    
    // Content relevance (40%)
    this.report.stats.contentRelevance = Math.round(
      ((totalFiles - removedFiles) / totalFiles) * 100
    );
    
    // Content cleanliness (30%)
    this.report.stats.contentCleanliness = Math.round(
      (cleanFiles / (totalFiles - removedFiles)) * 100
    );
    
    // Technical accuracy (20%) - based on processing success
    this.report.stats.technicalAccuracy = Math.round(
      ((totalFiles - this.report.issues.critical.length) / totalFiles) * 100
    );
    
    // Completeness (10%)
    this.report.stats.completeness = Math.round(
      ((cleanFiles + cleanedFiles) / (totalFiles - removedFiles)) * 100
    );
    
    // Calculate overall score
    this.report.qualityScore = Math.round(
      (this.report.stats.contentRelevance * 0.4) +
      (this.report.stats.contentCleanliness * 0.3) +
      (this.report.stats.technicalAccuracy * 0.2) +
      (this.report.stats.completeness * 0.1)
    );
  }

  private printReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONTENT QUALITY REPORT');
    console.log('='.repeat(60) + '\n');
    
    console.log(`📁 Total Files Analyzed: ${this.report.totalFiles}`);
    console.log(`❌ Files to Remove: ${this.report.filesRemoved.length}`);
    console.log(`✨ Files Cleaned: ${this.report.filesCleaned.length}`);
    console.log(`✅ Clean Files: ${this.report.filesClean.length}`);
    
    console.log('\n📈 Quality Scores:');
    console.log(`   Overall Score: ${this.report.qualityScore}/100`);
    console.log(`   - Content Relevance: ${this.report.stats.contentRelevance}% (40% weight)`);
    console.log(`   - Content Cleanliness: ${this.report.stats.contentCleanliness}% (30% weight)`);
    console.log(`   - Technical Accuracy: ${this.report.stats.technicalAccuracy}% (20% weight)`);
    console.log(`   - Completeness: ${this.report.stats.completeness}% (10% weight)`);
    
    if (this.report.filesRemoved.length > 0) {
      console.log('\n🚨 Files to Remove (non-design-system content):');
      this.report.filesRemoved.slice(0, 10).forEach(f => console.log(`   - ${f}`));
      if (this.report.filesRemoved.length > 10) {
        console.log(`   ... and ${this.report.filesRemoved.length - 10} more`);
      }
    }
    
    if (this.report.filesCleaned.length > 0) {
      console.log('\n⚠️  Files Needing Cleanup:');
      this.report.filesCleaned.slice(0, 10).forEach(f => console.log(`   - ${f}`));
      if (this.report.filesCleaned.length > 10) {
        console.log(`   ... and ${this.report.filesCleaned.length - 10} more`);
      }
    }
    
    console.log('\n💡 Recommendations:');
    console.log('   1. Remove identified non-design-system files');
    console.log('   2. Clean navigation/footer content from all entries');
    console.log('   3. Fix HTML artifacts and formatting issues');
    console.log('   4. Implement content validation before ingestion');
    console.log('   5. Add content quality checks to crawler');
    
    console.log('\n' + '='.repeat(60));
  }

  private saveReport(): void {
    const reportPath = path.join(process.cwd(), 'content-quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }
}

// CLI execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode - no files will be modified\n');
}

const cleaner = new ContentCleaner();
cleaner.run(dryRun).catch(console.error);