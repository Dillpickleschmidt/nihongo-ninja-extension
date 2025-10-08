import { Command, Message } from '@project/common';
import { CommandHandler } from '../command-handler';
import { YomitanDictionaryService } from '../../services/yomitan-dictionary-service';

interface DictionaryImportMessage extends Message {
    command: 'dictionary-import';
    fileName: string;
    fileData: ArrayBuffer;
}

interface DictionaryDownloadImportMessage extends Message {
    command: 'dictionary-download-import';
}

const JITENDEX_DOWNLOAD_URL =
    'https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip';

// Shared service instance across both handlers
let sharedDictionaryService: YomitanDictionaryService | null = null;

async function getDictionaryService(): Promise<YomitanDictionaryService> {
    if (!sharedDictionaryService) {
        sharedDictionaryService = new YomitanDictionaryService();
        await sharedDictionaryService.init();
    }
    return sharedDictionaryService;
}

export class DictionaryImportHandler implements CommandHandler {
    get sender() {
        return 'settings-ui';
    }

    get command() {
        return 'dictionary-import';
    }

    handle(
        request: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ): boolean {
        const message = request.message as DictionaryImportMessage;
        this.performImport(message)
            .then(() => {
                sendResponse({
                    success: true,
                    message: 'Dictionary import completed successfully',
                });
            })
            .catch((error) => {
                console.error('[DictionaryImport] Failed:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                });
            });

        return true; // Indicates we will call sendResponse asynchronously
    }

    private async performImport(message: DictionaryImportMessage): Promise<void> {
        const { fileName, fileData } = message;

        // Keep service worker alive during long import
        // Ping every 20 seconds to prevent termination
        const keepAlive = setInterval(() => {
            browser.runtime.getPlatformInfo();
        }, 20000);

        try {
            const service = await getDictionaryService();

            // Convert ArrayBuffer back to File
            const file = new File([fileData], fileName, { type: 'application/zip' });

            console.log(`[DictionaryImport] Importing ${fileName}...`);
            await service.importDictionary(file);
            console.log(`[DictionaryImport] Completed: ${fileName}`);

            // Show success notification
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icon/icon128.png',
                title: 'Dictionary Import Complete',
                message: `Successfully imported ${fileName}`,
            });
        } finally {
            // Always stop keep-alive, even if import fails
            clearInterval(keepAlive);
        }
    }
}

export class DictionaryDownloadImportHandler implements CommandHandler {
    get sender() {
        return 'settings-ui';
    }

    get command() {
        return 'dictionary-download-import';
    }

    handle(
        request: Command<Message>,
        sender: Browser.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ): boolean {
        this.downloadAndImport()
            .then(() => {
                sendResponse({
                    success: true,
                    message: 'Dictionary download and import started',
                });
            })
            .catch((error) => {
                console.error('[DictionaryDownload] Failed:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                });
            });

        return true; // Indicates we will call sendResponse asynchronously
    }

    private async downloadAndImport(): Promise<void> {
        // Keep service worker alive during long download + import
        // Ping every 20 seconds to prevent termination
        const keepAlive = setInterval(() => {
            browser.runtime.getPlatformInfo();
        }, 20000);

        try {
            console.log('[DictionaryDownload] Downloading Jitendex from GitHub...');

            // Download in background
            const response = await fetch(JITENDEX_DOWNLOAD_URL);

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log(`[DictionaryDownload] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

            // Convert to File and import
            const file = new File([arrayBuffer], 'jitendex-yomitan.zip', { type: 'application/zip' });

            console.log('[DictionaryDownload] Importing...');
            const service = await getDictionaryService();
            await service.importDictionary(file);
            console.log('[DictionaryDownload] Completed');

            // Show success notification
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icon/icon128.png',
                title: 'Jitendex Dictionary Installed',
                message: 'Successfully downloaded and imported Jitendex dictionary',
            });
        } finally {
            // Always stop keep-alive, even if download/import fails
            clearInterval(keepAlive);
        }
    }
}
