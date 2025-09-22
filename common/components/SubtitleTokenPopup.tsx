import React, { useState, useEffect } from 'react';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '../theme';
import { KagomeToken } from '../src/model';
import { getLanguageFromText } from '../src/yomitan/language/text-utilities';
import './material.css';
import './display.css';
import './YomitanPopup.css';
import './yomitan-structured-content.css';

// Yomitan's exact glossary data types (based on their TypeScript definitions)
type TermGlossaryString = string;

type TermGlossaryText = {
    type: 'text';
    text: string;
};

type TermGlossaryImage = {
    type: 'image';
    path: string;
    width?: number;
    height?: number;
    preferredWidth?: number;
    preferredHeight?: number;
    description?: string;
    pixelated?: boolean;
};

type TermGlossaryStructuredContent = {
    type: 'structured-content';
    content: any; // Can be string, object, or array - complex structure
};

type TermGlossaryDeinflection = [
    uninflected: string,
    inflectionRuleChain: string[]
];

type TermGlossaryContent =
    | TermGlossaryString
    | TermGlossaryText
    | TermGlossaryImage
    | TermGlossaryStructuredContent;

type TermGlossary =
    | TermGlossaryContent
    | TermGlossaryDeinflection;

export interface YomitanTermEntry {
    expression: string;
    reading: string;
    definitionTags: string;
    rules: string;
    score: number;
    glossary: TermGlossary[];
    sequence: number;
    termTags: string;
    dictionary: string;
    styles?: string; // Dictionary-specific CSS styles
}

// CSS Scoping Utilities (matching Yomitan's implementation exactly)
const addScopeToCss = (css: string, scopeSelector: string): string => {
    return scopeSelector + ' {' + css + '\n}';
};

const addDictionaryScopeToCss = (css: string, dictionaryTitle: string): string => {
    const escapedTitle = dictionaryTitle
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
    return addScopeToCss(css, `[data-dictionary="${escapedTitle}"]`);
};

interface SubtitleTokenPopupProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    token: KagomeToken | null;
    onClose: () => void;
    themeType?: string;
    onLookupYomitan?: (term: string) => Promise<YomitanTermEntry[]>;
}

const SubtitleTokenPopup: React.FC<SubtitleTokenPopupProps> = ({
    open,
    anchorEl,
    token,
    onClose,
    themeType = 'dark',
    onLookupYomitan,
}) => {
    const theme = createTheme(themeType as 'dark' | 'light');
    const [yomitanData, setYomitanData] = useState<YomitanTermEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDictionaryIndex, setCurrentDictionaryIndex] = useState(0);

    // Set theme for CSS variable inheritance (matching Yomitan's ThemeController)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateTheme = () => {
            const isDark = mediaQuery.matches;
            const theme = isDark ? 'dark' : 'light';

            // Set all data attributes that Yomitan's CSS expects
            document.documentElement.dataset.theme = theme;
            document.documentElement.dataset.browserTheme = theme;
            document.documentElement.dataset.siteTheme = theme; // Simplified - use browser theme
            document.documentElement.dataset.outerTheme = theme;
        };

        mediaQuery.addEventListener('change', updateTheme);
        updateTheme(); // Initial call

        return () => mediaQuery.removeEventListener('change', updateTheme);
    }, []);

    // Helper function to convert schema data object to React data attributes
    const convertDataToAttributes = (data: any) => {
        const attrs: { [key: string]: string } = {};
        if (data && typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
                // Capitalize first letter and add 'sc' prefix, following Yomitan's pattern
                const scKey = key.length > 0 ? `sc${key[0].toUpperCase()}${key.substring(1)}` : 'sc';
                // Convert camelCase to kebab-case for HTML data attributes
                const htmlKey = `data-${scKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
                attrs[htmlKey] = String(value);
            });
        }
        return attrs;
    };

    // Schema-exact structured content renderer
    const renderStructuredContent = (content: any): React.ReactNode => {
        if (!content) return null;

            // Handle string
            if (typeof content === 'string') {
                return content;
            }

            // Handle array
            if (Array.isArray(content)) {
                return content.map((item, index) => (
                    <React.Fragment key={index}>{renderStructuredContent(item)}</React.Fragment>
                ));
            }

            // Handle structured content object
            if (typeof content === 'object') {
                // Structured content wrapper
                if (content.type === 'structured-content') {
                    return renderStructuredContent(content.content);
                }

                // DOM element
                if (content.tag) {
                    const { tag, content: innerContent, title, lang, data } = content;


                    // Language detection
                    let detectedLanguage = lang;
                    if (!detectedLanguage && typeof innerContent === 'string') {
                        detectedLanguage = getLanguageFromText(innerContent, null);
                    }

                    // Generate CSS class and data attributes
                    const className = `gloss-sc-${tag}`;
                    const dataAttributes = convertDataToAttributes(data);

                // Comprehensive structured content element support based on schema
                switch (tag) {
                    case 'br':
                        return <br className={className} {...dataAttributes} />;

                    // Container elements with language support
                    case 'div':
                        return (
                            <div
                                className={className}
                                {...dataAttributes}
                                {...(detectedLanguage && { lang: detectedLanguage })}
                            >
                                {renderStructuredContent(innerContent)}
                            </div>
                        );
                    case 'span':
                        return (
                            <span
                                className={className}
                                {...dataAttributes}
                                title={title}
                                {...(detectedLanguage && { lang: detectedLanguage })}
                            >
                                {renderStructuredContent(innerContent)}
                            </span>
                        );

                    // Ruby annotation support (furigana)
                    case 'ruby':
                        return (
                            <ruby className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ruby>
                        );
                    case 'rt':
                        return (
                            <rt className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </rt>
                        );
                    case 'rp':
                        return (
                            <rp className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </rp>
                        );

                    // Table elements with enhanced support
                    case 'table':
                        // Yomitan wraps tables in a container with special class
                        const tableElement = (
                            <table className={className} {...dataAttributes}>
                                {Array.isArray(innerContent) && innerContent.length > 0 && innerContent[0]?.tag === 'tr' ? (
                                    <tbody>{renderStructuredContent(innerContent)}</tbody>
                                ) : (
                                    renderStructuredContent(innerContent)
                                )}
                            </table>
                        );
                        return (
                            <div className="gloss-sc-table-container">
                                {tableElement}
                            </div>
                        );
                    case 'tbody':
                        return (
                            <tbody className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tbody>
                        );
                    case 'thead':
                        return (
                            <thead className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </thead>
                        );
                    case 'tfoot':
                        return (
                            <tfoot className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tfoot>
                        );
                    case 'tr':
                        return (
                            <tr className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </tr>
                        );
                    case 'td':
                        const { colSpan, rowSpan } = content;
                        return (
                            <td
                                className={className}
                                {...dataAttributes}
                                {...(colSpan && { colSpan })}
                                {...(rowSpan && { rowSpan })}
                            >
                                {renderStructuredContent(innerContent)}
                            </td>
                        );
                    case 'th':
                        const { colSpan: thColSpan, rowSpan: thRowSpan } = content;
                        return (
                            <th
                                className={className}
                                {...dataAttributes}
                                {...(thColSpan && { colSpan: thColSpan })}
                                {...(thRowSpan && { rowSpan: thRowSpan })}
                            >
                                {renderStructuredContent(innerContent)}
                            </th>
                        );

                    // List elements
                    case 'ol':
                        return (
                            <ol className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ol>
                        );
                    case 'ul':
                        return (
                            <ul className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </ul>
                        );
                    case 'li':
                        return (
                            <li className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </li>
                        );

                    // Collapsible content support
                    case 'details':
                        const { open } = content;
                        return (
                            <details
                                className={className}
                                {...dataAttributes}
                                {...(open && { open })}
                            >
                                {renderStructuredContent(innerContent)}
                            </details>
                        );
                    case 'summary':
                        return (
                            <summary className={className} {...dataAttributes}>
                                {renderStructuredContent(innerContent)}
                            </summary>
                        );

                    // Link support
                    case 'a':
                        const { href } = content;


                        return (
                            <a
                                className={className}
                                {...dataAttributes}
                                href={href}
                                {...(!href?.startsWith('?') && { target: '_blank', rel: 'noopener noreferrer' })}
                            >
                                {renderStructuredContent(innerContent)}
                            </a>
                        );

                    // Image support
                    case 'img':
                        const { path, alt, width, height } = content;


                        return (
                            <img
                                className={className}
                                {...dataAttributes}
                                src={path}
                                alt={alt || title || ''}
                                {...(width && { width })}
                                {...(height && { height })}
                            />
                        );

                    default:
                        // Unknown tag - just render the content
                        return renderStructuredContent(innerContent);
                }
            }

            // Text object format
            if (content.type === 'text') {
                return content.text;
            }

            // Object with content property
            if (content.content) {
                return renderStructuredContent(content.content);
            }
        }

        return null;
    };

    useEffect(() => {
        if (token) {
            setIsLoading(true);
            setYomitanData(null);
            setCurrentDictionaryIndex(0);

            // Yomitan lookup
            if (onLookupYomitan) {
                onLookupYomitan(token.surface_form)
                    .then((yomitanResult) => {
                        setYomitanData(yomitanResult);
                    })
                    .catch((error) => {
                        console.error('Yomitan lookup failed:', error);
                        setYomitanData([]);
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            } else {
                setIsLoading(false);
                setYomitanData([]);
            }
        }
    }, [token, onLookupYomitan]);

    // Yomitan content utilities
    const GlossaryUtils = {
        // Single function to determine entry type
        getEntryType: (entry: TermGlossary): 'string' | 'text' | 'image' | 'structured-content' | 'deinflection' => {
            if (typeof entry === 'string') return 'string';
            if (Array.isArray(entry)) return 'deinflection';
            if (typeof entry === 'object' && entry !== null && 'type' in entry) {
                return entry.type as 'text' | 'image' | 'structured-content';
            }
            return 'string'; // fallback
        },

        // Type-safe filtering to exclude deinflections
        filterContent: (entries: TermGlossary[]): TermGlossaryContent[] =>
            entries.filter(entry => GlossaryUtils.getEntryType(entry) !== 'deinflection') as TermGlossaryContent[]
    };

    // Schema-exact glossary content normalization (3 formats only)
    const normalizeGlossaryContent = (glossary: any): any[] => {
        if (!glossary) return [];

        const glossaryArray = Array.isArray(glossary) ? glossary : [glossary];

        return glossaryArray.map(item => {
            // Schema format 1: Simple string
            if (typeof item === 'string') {
                return item;
            }

            // Schema format 2: Text object { type: "text", text: "..." }
            if (item?.type === 'text') {
                return item.text;
            }

            // Schema format 3: Structured content { type: "structured-content", content: [...] }
            if (item?.type === 'structured-content') {
                return item; // Pass through for renderStructuredContent
            }

            // Direct structured content (no wrapper)
            if (item?.tag || Array.isArray(item)) {
                return item;
            }

            // Fallback to string
            return String(item);
        });
    };

    const renderYomitanEntries = (entries: YomitanTermEntry[]) => {
        if (!entries.length) return null;

        const currentEntry = entries[currentDictionaryIndex] || entries[0];
        const normalizedGlossary = normalizeGlossaryContent(currentEntry.glossary);

        // Apply filtering to exclude deinflections
        const definitions = GlossaryUtils.filterContent(normalizedGlossary);

        // Generate scoped CSS for this dictionary (matching Yomitan's exact structure)
        const dictionaryCss = currentEntry.styles || '';
        const scopedCss = dictionaryCss ? addDictionaryScopeToCss(dictionaryCss, currentEntry.dictionary) : '';

        return (
            <div className="yomitan-glossary">
                {scopedCss && (
                    <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
                )}
                <div data-dictionary={currentEntry.dictionary}>
                    <div className="definition-list-container">
                        <ul className="gloss-list">
                            {definitions.map((meaning, meaningIndex) => (
                                <li key={meaningIndex} className="gloss-item">
                                    <span className="gloss-separator"></span>
                                    <span className="gloss-content structured-content">
                                        {renderStructuredContent(meaning)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {currentEntry.termTags && currentEntry.termTags.length > 0 && (
                        <div className="tag-list">
                            <span className="tag">{currentEntry.termTags}</span>
                        </div>
                    )}

                    <div className="dictionary-name">{currentEntry.dictionary}</div>

                    {entries.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentDictionaryIndex(Math.max(0, currentDictionaryIndex - 1));
                                }}
                                disabled={currentDictionaryIndex === 0}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: currentDictionaryIndex === 0 ? 'default' : 'pointer',
                                    opacity: currentDictionaryIndex === 0 ? 0.3 : 1,
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'inherit',
                                }}
                                title="Previous entry"
                            >
                                <ChevronLeftRounded sx={{ fontSize: '1.5rem' }} />
                            </button>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>
                                {currentDictionaryIndex + 1}/{entries.length}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentDictionaryIndex(Math.min(entries.length - 1, currentDictionaryIndex + 1));
                                }}
                                disabled={currentDictionaryIndex >= entries.length - 1}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: currentDictionaryIndex >= entries.length - 1 ? 'default' : 'pointer',
                                    opacity: currentDictionaryIndex >= entries.length - 1 ? 0.3 : 1,
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'inherit',
                                }}
                                title="Next entry"
                            >
                                <ChevronRightRounded sx={{ fontSize: '1.5rem' }} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={onClose}
                slotProps={{
                    root: {
                        'aria-hidden': false,
                    },
                }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                }}
                sx={{
                    zIndex: 2147483648,
                    pointerEvents: 'none',
                    '& .MuiPopover-paper': {
                        pointerEvents: 'auto',
                    },
                }}
            >
                <Paper
                    sx={{
                        width: 400,
                        height: 250,
                        padding: 0,
                        overflow: 'auto',
                    }}
                >
                    {token ? (
                        <div
                            style={{
                                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                                position: 'relative',
                                height: '100%',
                                fontSize: 'var(--font-size)',
                                lineHeight: 'var(--line-height)',
                            }}
                        >
                            <div className="entry">
                                <div className="headword-list">
                                    <span className="headword-term">
                                        {yomitanData &&
                                        yomitanData.length > 0 &&
                                        currentDictionaryIndex < yomitanData.length
                                            ? yomitanData[currentDictionaryIndex].expression
                                            : token.surface_form}
                                    </span>
                                    <span className="headword-reading">
                                        {yomitanData &&
                                        yomitanData.length > 0 &&
                                        currentDictionaryIndex < yomitanData.length
                                            ? yomitanData[currentDictionaryIndex].reading
                                            : token.pronunciation}
                                    </span>
                                </div>
                                <div className="tag-list">
                                    <span className="tag">
                                        {token.pos
                                            .split(',')
                                            .filter((p) => p !== '*')
                                            .join(', ')}
                                    </span>
                                </div>

                                {isLoading && (
                                    <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '1rem' }}>
                                        Loading dictionary...
                                    </div>
                                )}

                                {yomitanData && yomitanData.length > 0 ? (
                                    renderYomitanEntries(yomitanData)
                                ) : !isLoading ? (
                                    <div
                                        style={{ marginTop: '16px', textAlign: 'center', color: '#666', fontSize: '1rem' }}
                                    >
                                        No dictionary entries found.
                                        <br />
                                        <span style={{ fontSize: '0.9rem' }}>
                                            Import dictionaries in Settings → Dictionary tab
                                        </span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div>No token data available</div>
                    )}
                </Paper>
            </Popover>
        </ThemeProvider>
    );
};

export default SubtitleTokenPopup;