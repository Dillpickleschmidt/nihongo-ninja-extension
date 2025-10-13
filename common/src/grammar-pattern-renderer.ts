import { GrammarMatch, KagomeToken } from './model';

export interface LayeredGrammarPattern extends GrammarMatch {
    layer: number;
}

/**
 * Selects high-confidence grammar patterns and assigns vertical layers for rendering.
 * Filters out patterns that are completely contained within higher-confidence patterns.
 * Assigns layers based on overlap to allow stacked underlines.
 */
export function selectAndLayerGrammarPatterns(matches: GrammarMatch[]): LayeredGrammarPattern[] {
    if (!matches || matches.length === 0) {
        return [];
    }

    // Sort by confidence descending (highest confidence first)
    const sorted = [...matches].sort((a, b) => b.confidence - a.confidence);

    const selected: LayeredGrammarPattern[] = [];

    for (const match of sorted) {
        // Skip if completely contained in a higher-confidence match
        const isRedundant = selected.some(
            (s) =>
                s.start_char <= match.start_char &&
                s.end_char >= match.end_char &&
                s.confidence > match.confidence
        );

        if (isRedundant) {
            continue;
        }

        // Find overlapping patterns to determine layer
        const overlapping = selected.filter(
            (s) => !(match.end_char <= s.start_char || match.start_char >= s.end_char)
        );

        // Assign to the next available layer
        const layer = overlapping.length > 0 ? Math.max(...overlapping.map((s) => s.layer)) + 1 : 0;

        selected.push({ ...match, layer });
    }

    return selected;
}

/**
 * Builds HTML with token spans. Grammar patterns add classes to overlapping token spans.
 */
export function buildGrammarEnhancedHTML(
    text: string,
    tokens: KagomeToken[],
    grammarPatterns: LayeredGrammarPattern[],
    subtitleIndex: number
): string {
    // Pre-index grammar patterns by token (O(m) where m = patterns)
    const patternsByToken = new Map<number, LayeredGrammarPattern[]>();
    for (const pattern of grammarPatterns) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (pattern.start_char < token.end && pattern.end_char > token.start) {
                if (!patternsByToken.has(i)) {
                    patternsByToken.set(i, []);
                }
                patternsByToken.get(i)!.push(pattern);
            }
        }
    }

    const htmlSegments: string[] = [];
    let lastPos = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        // Add any text before this token (spaces, etc.)
        if (token.start > lastPos) {
            htmlSegments.push(text.substring(lastPos, token.start));
        }

        const overlappingPatterns = patternsByToken.get(i) || [];
        const tokenClassName = token.pos[0] === '記号' ? '' : 'asbplayer-kagome-token';

        if (tokenClassName) {
            // Build grammar underline divs for this token
            const grammarDivs = overlappingPatterns
                .map(p => {
                    return `<div class="grammar-underline grammar-layer-${p.layer}" data-pattern="${p.pattern_name}" title="${p.pattern_name} (${p.confidence})"></div>`;
                })
                .join('');

            htmlSegments.push(
                `<span class="${tokenClassName}" data-subtitle-index="${subtitleIndex}" data-token-index="${i}">${token.surface}${grammarDivs}</span>`
            );
        } else {
            htmlSegments.push(token.surface);
        }

        lastPos = token.end;
    }

    // Add remaining text
    if (lastPos < text.length) {
        htmlSegments.push(text.substring(lastPos));
    }

    return htmlSegments.join('');
}
