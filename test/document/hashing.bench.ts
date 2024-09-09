import { describe, bench } from 'vitest';
import {
    hash as hashBrowser,
    hashUIntArray,
} from '../../src/document/utils/browser';

const hashNode =
    typeof window === 'undefined'
        ? await import('../../src/document/utils/node')
        : null;

function base64ArrayBuffer(arrayBuffer: ArrayBuffer) {
    let base64 = '';
    const encodings =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const bytes = new Uint8Array(arrayBuffer);
    const byteLength = bytes.byteLength;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;

    let a, b, c, d;
    let chunk;

    // Main loop deals with bytes in chunks of 3
    for (let i = 0; i < mainLength; i = i + 3) {
        // Combine the three bytes into a single integer
        chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

        // Use bitmasks to extract 6-bit segments from the triplet
        a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
        b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
        c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
        d = chunk & 63; // 63       = 2^6 - 1

        // Convert the raw binary segments to the appropriate ASCII encoding
        base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
        chunk = bytes[mainLength];

        a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

        // Set the 4 least significant bits to zero
        b = (chunk & 3) << 4; // 3   = 2^2 - 1

        base64 += encodings[a] + encodings[b] + '==';
    } else if (byteRemainder == 2) {
        chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

        a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
        b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

        // Set the 2 least significant bits to zero
        c = (chunk & 15) << 2; // 15    = 2^4 - 1

        base64 += encodings[a] + encodings[b] + encodings[c] + '=';
    }

    return base64;
}

async function hashSubtle(text: string, callback: () => void, max: number) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    for (let i = 0; i < max; i++) {
        const buffer = await crypto.subtle.digest('SHA-1', data);
        base64ArrayBuffer(buffer);
    }
    callback();
}

const text = `{"attachments":{},"clipboard":[],"created":"2024-09-03T11:13:20.755Z","documentType":"","initialState":{"attachments":{},"created":"2024-09-03T11:13:20.755Z","documentType":"","lastModified":"2024-09-03T11:13:20.755Z","name":"","revision":{"global":0,"local":0},"state":{"global":{"attachments":{},"clipboard":[],"created":"2024-09-03T11:13:20.755Z","documentType":"","initialState":{"attachments":{},"created":"2024-09-03T11:13:20.755Z","documentType":"","lastModified":"2024-09-03T11:13:20.755Z","name":"","revision":{"global":0,"local":0},"state":{"global":{},"local":{}}},"lastModified":"2024-09-03T11:13:20.755Z","name":"","operations":{"global":[],"local":[]},"revision":{"global":0,"local":0},"state":{"global":{},"local":{}}},"local":{}}},"lastModified":"2024-09-03T11:13:20.755Z","name":"","operations":{"global":[],"local":[]},"revision":{"global":0,"local":0},"state":{"global":{"attachments":{},"clipboard":[],"created":"2024-09-03T11:13:20.755Z","documentType":"","initialState":{"attachments":{},"created":"2024-09-03T11:13:20.755Z","documentType":"","lastModified":"2024-09-03T11:13:20.755Z","name":"","revision":{"global":0,"local":0},"state":{"global":{},"local":{}}},"lastModified":"2024-09-03T11:13:20.755Z","name":"","operations":{"global":[],"local":[]},"revision":{"global":0,"local":0},"state":{"global":{},"local":{}}},"local":{}}}`;

describe('Hashing', () => {
    bench.skipIf(!hashNode)('Node', () => {
        for (let i = 0; i < 1000; i++) {
            hashNode?.hash(text);
        }
    });

    bench('Browser sha.js', () => {
        for (let i = 0; i < 1000; i++) {
            hashBrowser(text);
        }
    });

    bench('Browser sha1-uint8array', () => {
        for (let i = 0; i < 1000; i++) {
            hashUIntArray(text);
        }
    });

    bench.skipIf(hashNode)('SubtleCrypto', () => {
        return new Promise<void>((resolve, reject) => {
            hashSubtle(text, resolve, 1000).catch(reject);
        });
    });
});
