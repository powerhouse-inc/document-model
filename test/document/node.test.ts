import fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getLocalFile } from '../../src/document/utils';
import { hash as hashBrowser } from '../../src/document/utils/browser';
import { hash as hashNode } from '../../src/document/utils/node';

const isBrowser = typeof window !== 'undefined';

describe.skipIf(isBrowser)('Node utils', () => {
    const tempDir = './test/document/temp/utils/';
    const tempFile = `${tempDir}report.pdf`;

    beforeAll(() => {
        if (!fs.existsSync(tempDir))
            fs.mkdirSync(tempDir, {
                recursive: true,
            });
        fs.writeFileSync(tempFile, 'TEST');
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should parse file attributes', async () => {
        const file = await getLocalFile(tempFile);
        expect(file).toStrictEqual({
            data: 'VEVTVA==',
            hash: 'Q1pqSc2iiEdpNLjRefhjnQ3nNc8=',
            mimeType: 'application/pdf',
            extension: 'pdf',
            fileName: 'report.pdf',
        });
    });

    it("should throw exception when file doesn't exist", async () => {
        await expect(getLocalFile('as')).rejects.toBeDefined();
    });

    it('should hash in browser and node', () => {
        expect(hashNode('test')).toEqual(hashBrowser('test'));
    });
});
