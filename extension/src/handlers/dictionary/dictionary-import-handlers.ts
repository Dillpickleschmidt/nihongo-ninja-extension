import { Command, Message, DictionaryImportProgressMessage } from '@project/common';
import { CommandHandler } from '../command-handler';
import { YomitanDictionaryService } from '../../services/yomitan-dictionary-service';

interface DictionaryImportMessage extends Message {
    command: 'dictionary-import';
    fileName: string;
    fileDataBase64: string;
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
        const { fileName, fileDataBase64 } = message;

        // Keep service worker alive during long import
        // Ping every 20 seconds to prevent termination
        const keepAlive = setInterval(() => {
            browser.runtime.getPlatformInfo();
        }, 20000);

        try {
            // Decode Base64 string back to ArrayBuffer
            const binaryString = atob(fileDataBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            const service = await getDictionaryService();

            // Convert ArrayBuffer to File
            const file = new File([arrayBuffer], fileName, { type: 'application/zip' });

            browser.runtime.sendMessage({
                command: 'dictionary-import-progress',
                stepInfo: 'Step 1 of 2: Preparing dictionary',
                stepPercentage: 0,
            } as DictionaryImportProgressMessage).catch(() => {});

            let currentStep = 1;
            let stepCount = 0;

            const progressCallback = (progress: { index: number; count: number; nextStep?: boolean }) => {
                const { index, count, nextStep } = progress;

                if (nextStep) {
                    stepCount++;
                }

                if (stepCount >= 4 && currentStep === 1) {
                    currentStep = 2;
                }

                if (currentStep === 1 && count > 0) {
                    const percentage = (index / count) * 100;

                    const progressMessage: DictionaryImportProgressMessage = {
                        command: 'dictionary-import-progress',
                        stepInfo: 'Step 1 of 2: Preparing dictionary',
                        stepPercentage: Math.round(percentage),
                    };

                    browser.runtime.sendMessage(progressMessage).catch(() => {
                        // Ignore errors if tab is closed
                    });
                }

                if (currentStep === 2 && count > 0) {
                    const percentage = (index / count) * 100;

                    const progressMessage: DictionaryImportProgressMessage = {
                        command: 'dictionary-import-progress',
                        stepInfo: 'Step 2 of 2: Importing dictionary',
                        stepPercentage: Math.round(percentage),
                    };

                    browser.runtime.sendMessage(progressMessage).catch(() => {
                        // Ignore errors if tab is closed
                    });
                }
            };

            await service.importDictionary(file, progressCallback);

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

            // Download in background with progress tracking
            const response = await fetch(JITENDEX_DOWNLOAD_URL);

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            // Get total size from content-length header
            const contentLength = response.headers.get('content-length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Unable to read response body');
            }

            const chunks: Uint8Array[] = [];
            let loadedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                chunks.push(value);
                loadedBytes += value.length;

                const downloadProgress = totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0;

                const downloadProgressMessage: DictionaryImportProgressMessage = {
                    command: 'dictionary-import-progress',
                    stepInfo: 'Step 1 of 3: Downloading dictionary',
                    stepPercentage: Math.round(downloadProgress),
                };
                browser.runtime.sendMessage(downloadProgressMessage).catch(() => {
                    // Ignore errors
                });
            }

            // Combine chunks into single ArrayBuffer
            const arrayBuffer = new Uint8Array(loadedBytes);
            let offset = 0;
            for (const chunk of chunks) {
                arrayBuffer.set(chunk, offset);
                offset += chunk.length;
            }

            console.log(`[DictionaryDownload] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

            // Convert to File and import
            const file = new File([arrayBuffer], 'jitendex-yomitan.zip', { type: 'application/zip' });

            browser.runtime.sendMessage({
                command: 'dictionary-import-progress',
                stepInfo: 'Step 2 of 3: Preparing dictionary',
                stepPercentage: 0,
            } as DictionaryImportProgressMessage).catch(() => {});

            console.log('[DictionaryDownload] Importing...');
            const service = await getDictionaryService();

            let currentStep = 2;
            let stepCount = 0;

            const progressCallback = (progress: { index: number; count: number; nextStep?: boolean }) => {
                const { index, count, nextStep } = progress;

                if (nextStep) {
                    stepCount++;
                }

                if (stepCount >= 4 && currentStep === 2) {
                    currentStep = 3;
                }

                if (currentStep === 2 && count > 0) {
                    const percentage = (index / count) * 100;

                    const progressMessage: DictionaryImportProgressMessage = {
                        command: 'dictionary-import-progress',
                        stepInfo: 'Step 2 of 3: Preparing dictionary',
                        stepPercentage: Math.round(percentage),
                    };

                    browser.runtime.sendMessage(progressMessage).catch(() => {
                        // Ignore errors
                    });
                }

                if (currentStep === 3 && count > 0) {
                    const percentage = (index / count) * 100;

                    const progressMessage: DictionaryImportProgressMessage = {
                        command: 'dictionary-import-progress',
                        stepInfo: 'Step 3 of 3: Importing dictionary',
                        stepPercentage: Math.round(percentage),
                    };

                    browser.runtime.sendMessage(progressMessage).catch(() => {
                        // Ignore errors
                    });
                }
            };

            await service.importDictionary(file, progressCallback);
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
