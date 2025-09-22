/*
 * Yomitan Dictionary Service
 * Simple wrapper around Yomitan's DictionaryDatabase for nihongo-ninja-extension
 */

import { DictionaryDatabase } from '../../../common/src/yomitan/dictionary/dictionary-database';
import { DictionaryImporter } from '../../../common/src/yomitan/dictionary/dictionary-importer';
import { DictionaryImporterMediaLoader } from '../../../common/src/yomitan/dictionary/dictionary-importer-media-loader';
import { Translator } from '../../../common/src/yomitan/js/language/translator';

export interface DictionaryInfo {
    title: string;
    version: string;
    author?: string;
    url?: string;
    description?: string;
}

// Yomitan's exact internal format
export interface Tag {
    name: string;
    category: string;
    order: number;
    score: number;
    content: string[];
    dictionaries: string[];
    redundant: boolean;
}

export interface TermSource {
    originalText: string;
    transformedText: string;
    deinflectedText: string;
    matchType: string;
    matchSource: string;
    isPrimary: boolean;
}

export interface TermHeadword {
    index: number;
    term: string;
    reading: string;
    sources: TermSource[];
    tags: Tag[];
    wordClasses: string[];
}

export interface TermDefinition {
    index: number;
    headwordIndices: number[];
    dictionary: string;
    dictionaryIndex: number;
    dictionaryAlias: string;
    id: number;
    score: number;
    frequencyOrder: number;
    sequences: number[];
    isPrimary: boolean;
    tags: Tag[];
    entries: any[]; // TermGlossaryContent from dictionary-data
}

export interface TermDictionaryEntry {
    type: 'term';
    isPrimary: boolean;
    inflectionRuleChainCandidates: any[];
    score: number;
    frequencyOrder: number;
    dictionaryIndex: number;
    dictionaryAlias: string;
    sourceTermExactMatchCount: number;
    maxOriginalTextLength: number;
    headwords: TermHeadword[];
    definitions: TermDefinition[];
    pronunciations: any[];
    frequencies: any[];
}

export class YomitanDictionaryService {
    private db = new DictionaryDatabase();
    private importer: DictionaryImporter;
    private translator: Translator;
    private initialized = false;

    /**
     * Initialize the dictionary database
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.db.prepare();

            // Initialize the importer with media loader
            const mediaLoader = new DictionaryImporterMediaLoader();
            this.importer = new DictionaryImporter(mediaLoader);

            // Initialize Yomitan's Translator with our database
            this.translator = new Translator(this.db);

            // Prepare the translator to initialize language support
            this.translator.prepare();

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Yomitan dictionary service:', error);
            throw error;
        }
    }

    /**
     * Import a Yomitan dictionary from a ZIP file
     */
    async importDictionary(zipFile: File): Promise<void> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            console.log(`Importing dictionary: ${zipFile.name}`);

            // Convert File to ArrayBuffer for Yomitan
            const arrayBuffer = await zipFile.arrayBuffer();

            // Use DictionaryImporter.importDictionary method
            const importDetails = {
                prefixWildcardsSupported: true,
            };

            const result = await this.importer.importDictionary(this.db, arrayBuffer, importDetails);

            console.log(`Successfully imported dictionary: ${zipFile.name}`, result);
        } catch (error) {
            console.error('Failed to import dictionary:', error);
            throw error;
        }
    }

    /**
     * Look up terms using Yomitan's Translator (returns properly formatted results)
     */
    async lookupTerms(expressions: string[]): Promise<Map<string, TermDictionaryEntry[]>> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            // Get all enabled dictionaries
            const dictionaries = await this.getDictionaries();
            const enabledDictionaryMap = new Map(
                dictionaries.map((dict) => [dict.title, { index: 0, priority: 0, allowSecondarySearches: false }])
            );

            // Prepare options for Yomitan's Translator
            const options = {
                removeNonJapaneseCharacters: false,
                enabledDictionaryMap: enabledDictionaryMap,
                excludeDictionaryDefinitions: null,
                sortFrequencyDictionary: null,
                sortFrequencyDictionaryOrder: 'descending',
                language: 'ja',
                primaryReading: 'hiragana',
                wildcards: 'off',
                maxResults: 1000,
                textReplacements: [],
                textNormalizations: null,
                convertHalfWidthCharacters: 'false',
                convertNumericCharacters: 'false',
                convertAlphabeticCharacters: 'false',
                convertHiraganaToKatakana: 'false',
                convertKatakanaToHiragana: 'variant',
                collapseEmphaticSequences: 'false',
                deinflect: true
            };

            const groupedResults = new Map<string, TermDictionaryEntry[]>();

            // Use Yomitan's Translator to lookup each expression
            for (const expression of expressions) {
                const { dictionaryEntries } = await this.translator.findTerms('group', expression, options);
                if (dictionaryEntries.length > 0) {
                    groupedResults.set(expression, dictionaryEntries);
                }
            }

            return groupedResults;
        } catch (error) {
            console.error('Failed to lookup terms:', error);
            throw error;
        }
    }

    /**
     * Get list of installed dictionaries
     */
    async getDictionaries(): Promise<DictionaryInfo[]> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            const dictionaries = await this.db.getDictionaryInfo();
            return dictionaries.map((dict) => ({
                title: dict.title,
                version: dict.version,
                author: dict.author,
                url: dict.url,
                description: dict.description,
            }));
        } catch (error) {
            console.error('Failed to get dictionaries:', error);
            throw error;
        }
    }

    /**
     * Delete a dictionary by title
     */
    async deleteDictionary(title: string): Promise<void> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            await this.db.deleteDictionary(title);
            console.log(`Successfully deleted dictionary: ${title}`);
        } catch (error) {
            console.error('Failed to delete dictionary:', error);
            throw error;
        }
    }

    /**
     * Get database statistics
     */
    async getStats(): Promise<any> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            return await this.db.getDictionaryInfo();
        } catch (error) {
            console.error('Failed to get stats:', error);
            throw error;
        }
    }
}

