import type { Buffer } from 'buffer';

import Sha1 from 'sha.js/sha1';

const FileSystemError = new Error('File system not available.');

export function writeFile(
    path: string,
    name: string,
    stream: Uint8Array,
): Promise<string> {
    throw FileSystemError;
}

export function readFile(path: string) {
    throw FileSystemError;
}

export function fetchFile(
    url: string,
): Promise<{ data: Buffer; mimeType?: string }> {
    throw FileSystemError;
}

export const getFile = async (file: string) => {
    return readFile(file);
};

function hexToBase64(str: string) {
    let bString = '';
    for (let i = 0; i < str.length; i += 2) {
        bString += String.fromCharCode(parseInt(str.substr(i, 2), 16));
    }
    return btoa(bString);
}

export const hash = (data: string, algorithm = 'sha1') => {
    if (algorithm !== 'sha1') {
        throw new Error('Only sha1 algorithm is available.');
    }

    const sha1 = new Sha1();
    // @ts-ignore
    return hexToBase64(sha1.update(data).digest('hex'));
};
