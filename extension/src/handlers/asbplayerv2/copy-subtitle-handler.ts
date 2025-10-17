import {
    AsbPlayerToVideoCommand,
    Command,
    CopySubtitleMessage,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';
import TabRegistry from '../../services/tab-registry';

export default class CopySubtitleHandler {
    private readonly _tabRegistry: TabRegistry;

    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayerv2', 'asbplayer-video'];
    }

    get command() {
        return 'copy-subtitle';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const copySubtitleCommand = command as AsbPlayerToVideoCommand<CopySubtitleMessage>;

        // Extract tabId from either message body or sender parameter
        // For asbplayerv2 (side panel), it's in the message; for asbplayer-video (content script), it's in sender
        const tabId = 'tabId' in copySubtitleCommand ? copySubtitleCommand.tabId : sender.tab?.id;

        this._tabRegistry.publishCommandToVideoElements(
            (videoElement): ExtensionToVideoCommand<Message> | undefined => {
                if (videoElement.src !== copySubtitleCommand.src || videoElement.tab.id !== tabId) {
                    return undefined;
                }

                const copySubtitleCommandToVideo: ExtensionToVideoCommand<CopySubtitleMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle',
                        postMineAction: copySubtitleCommand.message.postMineAction,
                        subtitle: copySubtitleCommand.message.subtitle,
                        surroundingSubtitles: copySubtitleCommand.message.surroundingSubtitles,
                    },
                    src: videoElement.src,
                };
                return copySubtitleCommandToVideo;
            }
        );
        return false;
    }
}
