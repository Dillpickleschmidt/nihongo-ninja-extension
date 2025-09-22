/*
 * Yomitan Dictionary Service
 * Simple wrapper around Yomitan's DictionaryDatabase for nihongo-ninja-extension
 */

import { DictionaryDatabase } from '../../../common/src/yomitan/dictionary/dictionary-database';
import { DictionaryImporter } from '../../../common/src/yomitan/dictionary/dictionary-importer';
import { DictionaryImporterMediaLoader } from '../../../common/src/yomitan/dictionary/dictionary-importer-media-loader';

export interface DictionaryInfo {
    title: string;
    version: string;
    author?: string;
    url?: string;
    description?: string;
}

export interface TermEntry {
    id: number;
    dictionary: string;
    expression: string;
    reading: string;
    definitionTags: string[];
    rules: string[];
    score: number;
    glossary: (string | any)[];
    sequence: number;
    termTags: string[];
}

export interface TermDictionaryEntry extends TermEntry {
    styles?: string; // Dictionary-specific CSS styles
}

export class YomitanDictionaryService {
    private db = new DictionaryDatabase();
    private importer: DictionaryImporter;
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
     * Look up terms in all enabled dictionaries
     */
    async lookupTerms(expressions: string[]): Promise<Map<string, TermEntry[]>> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            // Get all enabled dictionaries
            const dictionaries = await this.getDictionaries();
            const enabledDictionaries = new Set(dictionaries.map((dict) => dict.title));

            // Perform bulk lookup
            const results = await this.db.findTermsBulk(expressions, enabledDictionaries);

            // Group results by expression
            const groupedResults = new Map<string, TermEntry[]>();

            // Results is directly an array of TermEntry objects from the database
            for (const termEntry of results) {
                // Use 'term' field from Yomitan's database structure
                const term = termEntry.term;

                if (!groupedResults.has(term)) {
                    groupedResults.set(term, []);
                }

                groupedResults.get(term)!.push(termEntry);
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
     * Get dictionary styles map (following Yomitan's getDictionaryStylesMap pattern)
     */
    async getDictionaryStylesMap(): Promise<Map<string, string>> {
        if (!this.initialized) {
            throw new Error('Dictionary service not initialized. Call init() first.');
        }

        try {
            const dictionaries = await this.db.getDictionaryInfo();
            const styleMap = new Map<string, string>();

            for (const dictionary of dictionaries) {
                const { title, styles } = dictionary;
                if (typeof styles === 'string' && styles.trim()) {
                    styleMap.set(title, styles);
                }
            }

            return styleMap;
        } catch (error) {
            console.error('Failed to get dictionary styles map:', error);
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

