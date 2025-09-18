interface JotobaWordSearchRequest {
    query: string;
    language: string;
    no_english: boolean;
}

interface JotobaNameSearchRequest {
    query: string;
    language: string;
    no_english: boolean;
}

interface JotobaWordReading {
    kana: string;
    kanji: string;
    furigana: string;
}

interface JotobaWordSense {
    glosses: string[];
    pos: string[];
    language: string;
}

interface JotobaPitchAccent {
    part: string;
    high: boolean;
}

interface JotobaWord {
    reading: JotobaWordReading;
    common: boolean;
    senses: JotobaWordSense[];
    audio: string;
    pitch: JotobaPitchAccent[];
}

interface JotobaName {
    kana: string;
    kanji: string;
    transcription: string;
    name_type: string[];
}

interface JotobaWordSearchResponse {
    kanji: any[];
    words: JotobaWord[];
}

interface JotobaNameSearchResponse {
    names: JotobaName[];
}

export class JotobaApiService {
    private static readonly BASE_URL = 'https://jotoba.de';

    static async searchWords(query: string): Promise<JotobaWord[]> {
        const request: JotobaWordSearchRequest = {
            query: query,
            language: 'English',
            no_english: false,
        };

        try {
            const response = await fetch(`${this.BASE_URL}/api/search/words`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`Jotoba API error: ${response.status}`);
            }

            const data: JotobaWordSearchResponse = await response.json();
            return data.words || [];
        } catch (error) {
            console.error('Failed to search words from Jotoba:', error);
            return [];
        }
    }

    static async searchNames(query: string): Promise<JotobaName[]> {
        const request: JotobaNameSearchRequest = {
            query: query,
            language: 'English',
            no_english: false,
        };

        try {
            const response = await fetch(`${this.BASE_URL}/api/search/names`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`Jotoba API error: ${response.status}`);
            }

            const data: JotobaNameSearchResponse = await response.json();
            return data.names || [];
        } catch (error) {
            console.error('Failed to search names from Jotoba:', error);
            return [];
        }
    }

    static async searchBasedOnToken(
        query: string,
        partOfSpeech: string
    ): Promise<{ words?: JotobaWord[]; names?: JotobaName[] }> {
        // Check if part of speech contains "固有名詞" at index 1
        const posArray = partOfSpeech.split(',');
        const isProperNoun = posArray.length > 1 && posArray[1] === '固有名詞';

        if (isProperNoun) {
            const names = await this.searchNames(query);
            return { names };
        } else {
            const words = await this.searchWords(query);
            return { words };
        }
    }
}

export type { JotobaWord, JotobaName, JotobaPitchAccent, JotobaWordReading, JotobaWordSense };

