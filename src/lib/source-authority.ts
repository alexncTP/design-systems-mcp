/**
 * Source Authority Configuration
 *
 * Defines reliability indicators, caveats, and authority hierarchy
 * for different content sources in the Design Systems MCP.
 *
 * This helps ensure users understand the context and limitations
 * of different information sources.
 */

export type SourceReliabilityLevel = 'gold_standard' | 'authoritative' | 'reference' | 'example' | 'community';
export type TestingStatus = 'production_tested' | 'community_validated' | 'reference_implementation' | 'not_verified';
export type ContentPurpose = 'specification' | 'guidance' | 'learning' | 'example' | 'discussion';

export interface SourceReliability {
  level: SourceReliabilityLevel;
  testingStatus: TestingStatus;
  purpose: ContentPurpose;
  caveats?: string[];
  preferredAlternatives?: string[];
  importantNote?: string;
}

export interface SourceAuthorityConfig {
  patterns: SourcePattern[];
  defaultReliability: SourceReliability;
}

export interface SourcePattern {
  /** URL pattern or source identifier to match */
  pattern: string | RegExp;
  /** Human-readable name for this source category */
  name: string;
  /** Reliability configuration for this source */
  reliability: SourceReliability;
}

/**
 * Source Authority Hierarchy
 *
 * Priority 1 (Gold Standard): WCAG Success Criteria, HTML Living Standard
 * Priority 2 (Authoritative): Inclusive Components, Gov.uk, Deque University
 * Priority 3 (Reference): APG patterns (with caveats)
 * Priority 4 (Examples): Individual design systems
 * Priority 5 (Community): Blog posts, tutorials, discussions
 */
export const SOURCE_AUTHORITY_CONFIG: SourceAuthorityConfig = {
  patterns: [
    // === GOLD STANDARD (Priority 1) ===
    {
      pattern: /w3\.org\/TR\/WCAG/i,
      name: 'WCAG Specification',
      reliability: {
        level: 'gold_standard',
        testingStatus: 'production_tested',
        purpose: 'specification',
        importantNote: 'Official W3C Web Content Accessibility Guidelines - the definitive accessibility standard.'
      }
    },
    {
      pattern: /html\.spec\.whatwg\.org/i,
      name: 'HTML Living Standard',
      reliability: {
        level: 'gold_standard',
        testingStatus: 'production_tested',
        purpose: 'specification',
        importantNote: 'Official HTML specification - defines native element semantics and behavior.'
      }
    },

    // === AUTHORITATIVE GUIDANCE (Priority 2) ===
    {
      pattern: /inclusive-components/i,
      name: 'Inclusive Components',
      reliability: {
        level: 'authoritative',
        testingStatus: 'production_tested',
        purpose: 'guidance',
        importantNote: 'Heydon Pickering\'s extensively tested accessible component patterns. Prioritizes semantic HTML.'
      }
    },
    {
      pattern: /design-system\.service\.gov\.uk/i,
      name: 'GOV.UK Design System',
      reliability: {
        level: 'authoritative',
        testingStatus: 'production_tested',
        purpose: 'guidance',
        importantNote: 'UK Government Design System - extensively tested with real users including those using assistive technology.'
      }
    },
    {
      pattern: /deque\.com|dequeuniversity/i,
      name: 'Deque University',
      reliability: {
        level: 'authoritative',
        testingStatus: 'production_tested',
        purpose: 'guidance',
        importantNote: 'Industry-leading accessibility training and patterns from axe-core creators.'
      }
    },
    {
      pattern: /a11yproject\.com/i,
      name: 'A11Y Project',
      reliability: {
        level: 'authoritative',
        testingStatus: 'community_validated',
        purpose: 'guidance',
        importantNote: 'Community-driven accessibility resource with practical, tested guidance.'
      }
    },

    // === REFERENCE IMPLEMENTATIONS (Priority 3) - WITH CAVEATS ===
    {
      pattern: /w3\.org\/WAI\/ARIA\/apg/i,
      name: 'ARIA Authoring Practices Guide (APG)',
      reliability: {
        level: 'reference',
        testingStatus: 'reference_implementation',
        purpose: 'learning',
        caveats: [
          'APG demonstrates ARIA usage patterns, NOT complete accessibility solutions',
          'Native HTML elements should ALWAYS be preferred over ARIA implementations',
          'Some APG examples have known issues with certain assistive technologies',
          'Always test with actual screen readers (NVDA, JAWS, VoiceOver) before production use',
          'APG patterns show HOW to use ARIA correctly, not WHEN to use it'
        ],
        preferredAlternatives: [
          'Semantic HTML elements (button, select, input, etc.)',
          'Inclusive Components by Heydon Pickering',
          'GOV.UK Design System patterns',
          'Deque University component patterns'
        ],
        importantNote: '⚠️ IMPORTANT: APG is a reference for ARIA mechanics, not a gold standard for accessibility. The first rule of ARIA is "Don\'t use ARIA" - always prefer semantic HTML.'
      }
    },
    {
      pattern: /aria-component-patterns|aria.*patterns/i,
      name: 'ARIA Component Patterns',
      reliability: {
        level: 'reference',
        testingStatus: 'reference_implementation',
        purpose: 'learning',
        caveats: [
          'These patterns demonstrate ARIA implementation, not accessibility best practices',
          'Prefer native HTML elements over ARIA-enhanced divs and spans',
          'Test thoroughly with assistive technology before production deployment'
        ],
        preferredAlternatives: [
          'Native HTML form controls',
          'Semantic HTML5 elements',
          'Browser-native dialogs and popovers'
        ],
        importantNote: '⚠️ Reference implementation only. Validate with assistive technology testing.'
      }
    },

    // === DESIGN SYSTEM EXAMPLES (Priority 4) ===
    {
      pattern: /material\.io|material-design/i,
      name: 'Material Design',
      reliability: {
        level: 'example',
        testingStatus: 'production_tested',
        purpose: 'example',
        importantNote: 'Google\'s design system - well-tested but represents one organization\'s approach.'
      }
    },
    {
      pattern: /carbondesignsystem/i,
      name: 'Carbon Design System',
      reliability: {
        level: 'example',
        testingStatus: 'production_tested',
        purpose: 'example',
        importantNote: 'IBM\'s design system - comprehensive but reflects IBM\'s specific needs and conventions.'
      }
    },
    {
      pattern: /primer\.style|github.*design/i,
      name: 'GitHub Primer',
      reliability: {
        level: 'example',
        testingStatus: 'production_tested',
        purpose: 'example',
        importantNote: 'GitHub\'s design system - proven at scale but specific to GitHub\'s context.'
      }
    },
    {
      pattern: /spectrum\.adobe/i,
      name: 'Adobe Spectrum',
      reliability: {
        level: 'example',
        testingStatus: 'production_tested',
        purpose: 'example',
        importantNote: 'Adobe\'s design system with strong accessibility focus.'
      }
    },
    {
      pattern: /polaris.*shopify|shopify.*polaris/i,
      name: 'Shopify Polaris',
      reliability: {
        level: 'example',
        testingStatus: 'production_tested',
        purpose: 'example',
        importantNote: 'Shopify\'s design system - e-commerce focused patterns.'
      }
    },

    // === COMMUNITY CONTENT (Priority 5) ===
    {
      pattern: /medium\.com|dev\.to|css-tricks/i,
      name: 'Community Article',
      reliability: {
        level: 'community',
        testingStatus: 'not_verified',
        purpose: 'discussion',
        caveats: [
          'Community content may not be thoroughly tested',
          'Verify claims against authoritative sources',
          'Check publication date - best practices evolve'
        ],
        importantNote: 'Community perspective - validate with authoritative sources before implementation.'
      }
    }
  ],

  defaultReliability: {
    level: 'community',
    testingStatus: 'not_verified',
    purpose: 'discussion',
    caveats: [
      'Source reliability not specifically categorized',
      'Validate information against authoritative sources before implementation'
    ]
  }
};

/**
 * Get reliability information for a given source URL or identifier
 */
export function getSourceReliability(sourceLocation: string): SourceReliability {
  for (const pattern of SOURCE_AUTHORITY_CONFIG.patterns) {
    const regex = typeof pattern.pattern === 'string'
      ? new RegExp(pattern.pattern, 'i')
      : pattern.pattern;

    if (regex.test(sourceLocation)) {
      return pattern.reliability;
    }
  }

  return SOURCE_AUTHORITY_CONFIG.defaultReliability;
}

/**
 * Get the source category name for a given URL
 */
export function getSourceCategoryName(sourceLocation: string): string {
  for (const pattern of SOURCE_AUTHORITY_CONFIG.patterns) {
    const regex = typeof pattern.pattern === 'string'
      ? new RegExp(pattern.pattern, 'i')
      : pattern.pattern;

    if (regex.test(sourceLocation)) {
      return pattern.name;
    }
  }

  return 'General Resource';
}

/**
 * Format reliability indicator for display
 */
export function formatReliabilityBadge(level: SourceReliabilityLevel): string {
  const badges: Record<SourceReliabilityLevel, string> = {
    gold_standard: '🥇 Gold Standard',
    authoritative: '✅ Authoritative',
    reference: '📚 Reference',
    example: '💡 Example',
    community: '👥 Community'
  };
  return badges[level] || '📄 Resource';
}

/**
 * Format caveats as a disclaimer block
 */
export function formatCaveatsDisclaimer(reliability: SourceReliability): string | null {
  if (!reliability.caveats || reliability.caveats.length === 0) {
    return null;
  }

  const lines = [
    '',
    '---',
    '⚠️ **Important Context:**',
    ...reliability.caveats.map(caveat => `• ${caveat}`)
  ];

  if (reliability.preferredAlternatives && reliability.preferredAlternatives.length > 0) {
    lines.push('');
    lines.push('**Consider these alternatives:**');
    lines.push(...reliability.preferredAlternatives.map(alt => `• ${alt}`));
  }

  if (reliability.importantNote) {
    lines.push('');
    lines.push(reliability.importantNote);
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Check if source requires accessibility caveats
 */
export function requiresAccessibilityCaveats(sourceLocation: string): boolean {
  const apgPatterns = [
    /w3\.org\/WAI\/ARIA\/apg/i,
    /aria-authoring-practices/i,
    /aria.*component.*patterns/i,
    /apg.*patterns/i
  ];

  return apgPatterns.some(pattern => pattern.test(sourceLocation));
}

/**
 * Get accessibility guidance disclaimer for APG-related content
 */
export function getAccessibilityGuidanceDisclaimer(): string {
  return `
---
⚠️ **Accessibility Implementation Guidance**

When implementing accessible components, follow this priority order:

1. **Use semantic HTML first** - Native elements like \`<button>\`, \`<select>\`, \`<input>\` are already accessible
2. **Enhance with ARIA only when necessary** - ARIA should supplement, not replace HTML semantics
3. **Test with real assistive technology** - Screen readers (NVDA, JAWS, VoiceOver), keyboard navigation
4. **Validate against WCAG** - Ensure compliance with Web Content Accessibility Guidelines

**Resources for production-ready accessible patterns:**
• [Inclusive Components](https://inclusive-components.design/) - Tested patterns prioritizing HTML
• [GOV.UK Design System](https://design-system.service.gov.uk/) - Extensively user-tested
• [Deque University](https://www.deque.com/resources/) - From the axe-core accessibility experts
---
`;
}
