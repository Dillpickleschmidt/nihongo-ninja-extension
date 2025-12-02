import { PatternMatch, KagomeToken } from './model';

export interface LayeredPatternMatch extends PatternMatch {
    layer: number;
    patternId: string;
}

// Builds bidirectional index of pattern-token overlaps
function buildPatternTokenIndex<T extends PatternMatch>(patterns: T[], tokens: KagomeToken[]) {
    const patternToTokens = new Map<number, Set<number>>();
    const tokenToPatterns = new Map<number, T[]>();

    for (let patternIdx = 0; patternIdx < patterns.length; patternIdx++) {
        const pattern = patterns[patternIdx];
        const tokenSet = new Set<number>();

        for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
            const token = tokens[tokenIdx];
            if (pattern.start_char < token.end && pattern.end_char > token.start) {
                tokenSet.add(tokenIdx);

                if (!tokenToPatterns.has(tokenIdx)) {
                    tokenToPatterns.set(tokenIdx, []);
                }
                tokenToPatterns.get(tokenIdx)!.push(pattern);
            }
        }

        patternToTokens.set(patternIdx, tokenSet);
    }

    return { patternToTokens, tokenToPatterns };
}

// Filters redundant patterns and assigns layers for stacked underlines
export function selectAndLayerGrammarPatterns(
    matches: PatternMatch[],
    tokens: KagomeToken[],
    subtitleIndex: number
): LayeredPatternMatch[] {
    if (matches.length === 0 || tokens.length === 0) {
        return [];
    }

    // Filter to Construction patterns only (Conjugation patterns are used only for token combining)
    const constructionMatches = matches.filter((m) => m.category === 'Construction');

    if (constructionMatches.length === 0) {
        return [];
    }

    // Build pattern-token overlap index
    const { patternToTokens } = buildPatternTokenIndex(constructionMatches, tokens);

    // Filter patterns: remove those whose token-set is completely contained in a higher-confidence pattern
    const selectedPatterns: PatternMatch[] = [];
    const sortedByConfidence = [...constructionMatches]
        .map((m, idx) => ({ pattern: m, originalIdx: idx }))
        .sort((a, b) => b.pattern.confidence - a.pattern.confidence);

    for (const { pattern, originalIdx } of sortedByConfidence) {
        const patternTokens = patternToTokens.get(originalIdx)!;

        // Check if this pattern's token-set is contained in any higher-confidence selected pattern
        const isRedundant = selectedPatterns.some((selected) => {
            const selectedIdx = constructionMatches.indexOf(selected);
            const selectedTokens = patternToTokens.get(selectedIdx)!;

            // Check if patternTokens ⊆ selectedTokens
            if (patternTokens.size > selectedTokens.size) return false;

            for (const tokenIdx of patternTokens) {
                if (!selectedTokens.has(tokenIdx)) return false;
            }

            return true; // All tokens in patternTokens are in selectedTokens
        });

        if (!isRedundant) {
            selectedPatterns.push(pattern);
        }
    }

    // Apply layering to selected patterns and compute pattern IDs
    const layered: LayeredPatternMatch[] = [];
    for (const match of selectedPatterns) {
        // Find overlapping patterns to determine layer
        const overlapping = layered.filter((s) => !(match.end_char <= s.start_char || match.start_char >= s.end_char));

        // Assign to the next available layer
        const layer = overlapping.length > 0 ? Math.max(...overlapping.map((s) => s.layer)) + 1 : 0;

        // Pre-compute pattern ID for hover highlighting
        const patternId = `${subtitleIndex}-${match.start_char}-${match.end_char}-${match.pattern_name}`;

        layered.push({ ...match, layer, patternId });
    }

    return layered;
}

// Builds HTML with token spans and grammar pattern underlines
export function buildGrammarEnhancedHTML(
    text: string,
    tokens: KagomeToken[],
    grammarPatterns: LayeredPatternMatch[],
    subtitleIndex: number
): string {
    // Build pattern-token overlap index
    const { tokenToPatterns: patternsByToken } = buildPatternTokenIndex(grammarPatterns, tokens);

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
                .map((p) => {
                    return `<div class="grammar-underline grammar-layer-${p.layer}" data-pattern="${p.pattern_name}" data-pattern-id="${p.patternId}" title="${p.pattern_name} (${p.confidence})"></div>`;
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
