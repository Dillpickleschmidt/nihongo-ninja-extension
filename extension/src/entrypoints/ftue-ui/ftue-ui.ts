import { renderFtueUi } from '@/ui/ftue';
import '../video.content/video.css';
import '@project/common/components/material.css';
import '@project/common/components/display.css';
import '@project/common/components/YomitanPopup.css';
import '@project/common/components/yomitan-structured-content.css';
import { currentPageDelegate } from '@/services/pages';

window.addEventListener('load', () => {
    currentPageDelegate().then((pageDelegate) => {
        pageDelegate?.loadScripts();
    });
    const root = document.getElementById('root')!;
    renderFtueUi(root);
});
