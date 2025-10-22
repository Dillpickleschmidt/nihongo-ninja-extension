import { useState, useEffect, useCallback } from 'react';

export function useDictionaryImportProgress() {
    const [dictionaryImportProgress, setDictionaryImportProgress] = useState({
        visible: false,
        stepInfo: '',
        percentage: 0,
    });

    useEffect(() => {
        const handleMessage = (
            message: any,
            sender: Browser.runtime.MessageSender,
            sendResponse: (response?: any) => void
        ) => {
            if (message.command === 'dictionary-import-progress') {
                const { stepInfo, stepPercentage } = message;

                setDictionaryImportProgress({
                    visible: true,
                    stepInfo,
                    percentage: stepPercentage,
                });
            } else if (message.command === 'dictionary-import-complete') {
                setDictionaryImportProgress({ visible: false, stepInfo: '', percentage: 0 });
            }
        };

        browser.runtime.onMessage.addListener(handleMessage);

        return () => {
            browser.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const handleReset = useCallback(() => {
        setDictionaryImportProgress({ visible: false, stepInfo: '', percentage: 0 });
    }, []);

    return { dictionaryImportProgress, handleReset };
}
