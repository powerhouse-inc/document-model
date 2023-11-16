import JSZip from 'jszip';
import mime from 'mime/lite';
import { BaseAction } from '../actions/types';
import type {
    Action,
    Attachment,
    AttachmentInput,
    AttachmentRef,
    Document,
    DocumentHeader,
    ExtendedState,
    Operation,
    Reducer,
} from '../types';
import { fetchFile, getFile, hash, readFile, writeFile } from './node';

export type FileInput = string | number[] | Uint8Array | ArrayBuffer | Blob;

export const createZip = async (
    document: Document<unknown, Action, unknown>,
) => {
    // create zip file
    const zip = new JSZip();

    const { name, revision, documentType, created, lastModified } = document;
    const header: DocumentHeader = {
        name,
        revision,
        documentType,
        created,
        lastModified,
    };
    zip.file('header.json', JSON.stringify(header, null, 2));
    zip.file(
        'state.json',
        JSON.stringify(document.initialState || {}, null, 2),
    );
    zip.file('operations.json', JSON.stringify(document.operations, null, 2));

    const attachments = Object.keys(document.attachments) as AttachmentRef[];
    attachments.forEach(key => {
        const { data, ...attributes } = document.attachments[key];
        zip.file(key, data, {
            base64: true,
            createFolders: true,
            comment: JSON.stringify(attributes),
        });
    });
    return zip;
};

/**
 * Saves a document to a ZIP file.
 *
 * @remarks
 * This function creates a ZIP file containing the document's state, operations,
 * and file attachments. The file is saved to the specified path.
 *
 * @param document - The document to save to the file.
 * @param path - The path to save the file to.
 * @param extension - The extension to use for the file.
 * @returns A promise that resolves to the path of the saved file.
 */
export const saveToFile = async (
    document: Document<unknown, Action, unknown>,
    path: string,
    extension: string,
    name?: string,
): Promise<string> => {
    // create zip file
    const zip = await createZip(document);
    const file = await zip.generateAsync({
        type: 'uint8array',
        streamFiles: true,
    });
    const fileName = name ?? document.name;
    const fileExtension = `.${extension}.zip`;

    return writeFile(
        path,
        fileName.endsWith(fileExtension)
            ? fileName
            : `${fileName}${fileExtension}`,
        file,
    );
};

export const saveToFileHandle = async (
    document: Document,
    input: FileSystemFileHandle,
) => {
    const zip = await createZip(document);
    const blob = await zip.generateAsync({ type: 'blob' });
    const writable = await input.createWritable();
    await writable.write(blob);
    await writable.close();
};

/**
 * Loads a document from a ZIP file.
 *
 * @remarks
 * This function reads a ZIP file and returns the document state after
 * applying all the operations. The reducer is used to apply the operations.
 *
 * @typeParam S - The type of the state object.
 * @typeParam A - The type of the actions that can be applied to the state object.
 *
 * @param path - The path to the ZIP file.
 * @param reducer - The reducer to apply the operations to the state object.
 * @returns A promise that resolves to the document state after applying all the operations.
 * @throws An error if the initial state or the operations history is not found in the ZIP file.
 */
export const loadFromFile = async <S, A extends Action, M>(
    path: string,
    reducer: Reducer<S, A, M>,
) => {
    const file = readFile(path);
    return loadFromInput(file, reducer);
};

export const loadFromInput = async <S, A extends Action, M>(
    input: FileInput,
    reducer: Reducer<S, A, M>,
) => {
    const zip = new JSZip();
    await zip.loadAsync(input);
    return loadFromZip(zip, reducer);
};

async function loadFromZip<S, A extends Action, M>(
    zip: JSZip,
    reducer: Reducer<S, A, M>,
) {
    const initialStateZip = zip.file('state.json');
    if (!initialStateZip) {
        throw new Error('Initial state not found');
    }
    const initialStateStr = await initialStateZip.async('string');
    const initialState = JSON.parse(initialStateStr) as ExtendedState<S>;

    const headerZip = zip.file('header.json');
    let header: DocumentHeader | null = null;
    if (headerZip) {
        header = JSON.parse(await headerZip.async('string'));
    }

    const operationsZip = zip.file('operations.json');
    if (!operationsZip) {
        throw new Error('Operations history not found');
    }
    const operations = JSON.parse(
        await operationsZip.async('string'),
    ) as Operation<A | BaseAction>[];

    const metaZip = zip.file('meta.json');
    let meta = {} as M;
    if (metaZip) {
        meta = JSON.parse(await metaZip.async('string'));
    }

    const document: Document<S, A, M> = {
        ...initialState,
        ...header,
        initialState,
        operations: [],
        attachments: { ...initialState.attachments },
        meta,
    };

    let result = operations
        .slice(0, header?.revision)
        .reduce(
            (document, operation) => reducer(document, operation),
            document,
        );

    if (header) {
        result = {
            ...result,
            ...header,
            operations: [
                ...result.operations,
                ...operations.slice(header.revision),
            ],
        };
    }
    return result;
}

function getFileAttributes(
    file: string,
): Omit<Attachment, 'data' | 'mimeType'> {
    const extension = file.replace(/^.*\./, '') || undefined;
    const fileName = file.replace(/^.*[/\\]/, '') || undefined;
    return { extension, fileName };
}

/**
 * Fetches an attachment from a URL and returns its base64-encoded data and MIME type.
 * @param url - The URL of the attachment to fetch.
 * @returns A Promise that resolves to an object containing the base64-encoded data and MIME type of the attachment.
 */
export async function getRemoteFile(url: string): Promise<AttachmentInput> {
    const { buffer, mimeType = 'application/octet-stream' } =
        await fetchFile(url);
    const attributes = getFileAttributes(url);
    const data = buffer.toString('base64');
    return {
        data,
        hash: hash(data),
        mimeType,
        ...attributes,
    };
}

/**
 * Reads an attachment from a file and returns its base64-encoded data and MIME type.
 * @param path - The path of the attachment file to read.
 * @returns A Promise that resolves to an object containing the base64-encoded data and MIME type of the attachment.
 */
export async function getLocalFile(path: string): Promise<AttachmentInput> {
    const buffer = await getFile(path);
    const mimeType = mime.getType(path) || 'application/octet-stream';
    const attributes = getFileAttributes(path);
    const data = buffer.toString('base64');
    return { data, hash: hash(data), mimeType, ...attributes };
}
