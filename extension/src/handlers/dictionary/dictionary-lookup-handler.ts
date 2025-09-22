import { Command, Message } from '@project/common';
import { CommandHandler } from '../command-handler';
import { YomitanDictionaryService } from '../../services/yomitan-dictionary-service';

interface DictionaryLookupMessage extends Message {
    command: 'dictionary-lookup';
    term: string;
}

export default class DictionaryLookupHandler implements CommandHandler {
    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'dictionary-lookup';
    }

    private dictionaryService: YomitanDictionaryService | null = null;

    private async getDictionaryService(): Promise<YomitanDictionaryService> {
        if (!this.dictionaryService) {
            this.dictionaryService = new YomitanDictionaryService();
            await this.dictionaryService.init();
        }
        return this.dictionaryService;
    }

    handle(request: Command<DictionaryLookupMessage>, sender: any, sendResponse: (response: any) => void): boolean {
        this.performLookup(request.message.term)
            .then((entries) => {
                const mappedEntries = entries.map((entry) => {
                    // Yomitan returns 'term' from database 'expression' field
                    // and 'definitions' from database 'glossary' field
                    return {
                        expression: entry.term || entry.expression || '',
                        reading: entry.reading || '',
                        definitionTags: Array.isArray(entry.definitionTags)
                            ? entry.definitionTags.join(' ')
                            : String(entry.definitionTags || ''),
                        rules: Array.isArray(entry.rules) ? entry.rules.join(' ') : String(entry.rules || ''),
                        score: entry.score || 0,
                        glossary: entry.definitions || entry.glossary || [],
                        sequence: entry.sequence || 0,
                        termTags: Array.isArray(entry.termTags)
                            ? entry.termTags.join(' ')
                            : String(entry.termTags || ''),
                        dictionary: entry.dictionary || '',
                    };
                });
                sendResponse({
                    success: true,
                    entries: mappedEntries,
                });
            })
            .catch((error) => {
                console.error('Dictionary lookup failed:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                });
            });

        return true; // Indicates we will call sendResponse asynchronously
    }

    private async performLookup(term: string): Promise<any[]> {
        try {
            const service = await this.getDictionaryService();
            const results = await service.lookupTerms([term]);
            return results.get(term) || [];
        } catch (error) {
            console.error('Dictionary service lookup failed:', error);
            return [];
        }
    }
}

