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
                // Pass through the new TermDictionaryEntry format directly
                // No conversion needed since YomitanDictionaryService now returns the correct format
                sendResponse({
                    success: true,
                    entries: entries,
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

