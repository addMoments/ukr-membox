import { fonts } from "../types/fonts";

export const applyGuestFont = (fontId: string) => {
    let font = fonts.find(font => font.id === fontId);
    if (!font) font = fonts[0];

    const ids = (id: string) => document.getElementById(id);

    const existingLink = ids('guestFont');
    if (existingLink) {
        existingLink.remove();
        ids('guestFontStyle')?.remove();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.url;
    link.id = "guestFont"
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
        body {
            font-family: ${font.fontFamily};
        }
    `;
    style.id = "guestFontStyle"
    document.head.appendChild(style);
    
}