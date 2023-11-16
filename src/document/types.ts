import type { Draft } from 'immer';
import type { FC } from 'react';
import type { DocumentModelState } from '../document-model/';
import type { BaseAction } from './actions/types';
import { BaseDocument } from './object';
import { FileInput } from './utils';
export { z } from './schema';
export type * from './schema/types';
export type { FileInput } from './utils';
export type { Immutable } from 'immer';

/**
 * Defines the basic structure of an action.
 *
 * @typeParam T - The name of the action type. A `string` type by default.
 */
export type Action<T extends string = string, I = unknown> = {
    /** The name of the action. */
    type: T;
    /** The payload of the action. */
    input: I;
    /** The attachments included in the action. */
    attachments?: AttachmentInput[] | undefined;
};

export type ActionWithAttachment<
    T extends string = string,
    I = unknown,
> = Action<T, I> & {
    attachments: AttachmentInput[];
};

/**
 * A pure function that takes an action and the previous state
 * of the document and returns the new state.
 *
 * @typeParam State - The type of the document data.
 * @typeParam A - The type of the actions supported by the reducer.
 */
export type Reducer<State, A extends Action, M = unknown> = (
    state: Document<State, A, M>,
    action: A | BaseAction,
) => Document<State, A, M>;

/**
 * A {@link Reducer} that prevents mutable code from changing the previous state.
 *
 * @remarks
 * This reducer is wrapped with {@link https://immerjs.github.io/immer/ | Immer}.
 * This allows the reducer code to be mutable, making it simpler and
 * avoiding unintended changes in the provided state.
 * The returned state will always be a new object.
 *
 * @typeParam State - The type of the document data.
 * @typeParam A - The type of the actions supported by the reducer.
 */
export type ImmutableReducer<State, A extends Action, M> = (
    state: Draft<Document<State, A, M>>,
    action: A | BaseAction,
) => Document<State, A, M> | void;

export type ImmutableStateReducer<State, A extends Action, M> = (
    state: Draft<State>,
    action: A,
) => State | void;

/**
 * An operation that was applied to a {@link Document}.
 *
 * @remarks
 * Wraps an action with an index, to be added to the operations history of a Document.
 * The `index` field is used to keep all operations in order and enable replaying the
 * document's history from the beginning.
 *
 * @typeParam A - The type of the action.
 */
export type Operation<A extends Action = Action> = A & {
    /** Position of the operation in the history */
    index: number;
    /** Timestamp of when the operation was added */
    timestamp: string;
    /** Hash of the resulting document data after the operation */
    hash: string;
};

/**
 * The base attributes of a {@link Document}.
 */
export type DocumentHeader = {
    /** The name of the document. */
    name: string;
    /** The number of operations applied to the document. */
    revision: number;
    /** The type of the document model. */
    documentType: string;
    /** The timestamp of the creation date of the document. */
    created: string;
    /** The timestamp of the last change in the document. */
    lastModified: string;
};

/**
 * The attributes stored for a file. Namely, attachments of a document.
 */
export type Attachment = {
    /** The binary data of the attachment in Base64 */
    data: string;
    /** The MIME type of the attachment */
    mimeType: string;
    // The extension of the attachment.
    extension?: string | null;
    // The file name of the attachment.
    fileName?: string | null;
};

export type AttachmentInput = Attachment & {
    hash: string;
};

/**
 * Object that indexes attachments of a Document.
 *
 * @remarks
 * This is used to reduce memory usage to avoid
 * multiple instances of the binary data of the attachments.
 *
 */
export type FileRegistry = Record<AttachmentRef, Attachment>;

export type ExtendedState<State = unknown> = DocumentHeader & {
    /** The document model specific state. */
    state: State;
    /** The index of document attachments. */
    attachments: FileRegistry;
};

/**
 * The base type of a document model.
 *
 * @remarks
 * This type is extended by all Document models.
 *
 * @typeParam Data - The type of the document data attribute.
 * @typeParam A - The type of the actions supported by the Document.
 */
export type Document<S = unknown, A extends Action = Action, M = unknown> =
    /** The document model specific state. */
    ExtendedState<S> & {
        /** The operations history of the document. */
        operations: Operation<A | BaseAction>[];
        /** The initial state of the document, enabling replaying operations. */
        initialState: ExtendedState<S>;
        meta: M;
    };

/**
 * String type representing an attachment in a Document.
 *
 * @remarks
 * Attachment string is formatted as `attachment://<filename>`.
 */
export type AttachmentRef = string; // TODO `attachment://${string}`;

export interface DocumentClass<
    S,
    A extends Action = Action,
    M = unknown,
    C extends BaseDocument<S, A, M> = BaseDocument<S, A, M>,
> {
    fileExtension: string;
    fromFile: (path: string) => Promise<C>;
    new (initialState?: ExtendedState<S>): C;
}

export type DocumentModelUtils<
    S = unknown,
    A extends Action = Action,
    M = unknown,
> = {
    fileExtension: string;
    createState: (state?: Partial<S>) => S;
    createExtendedState: (
        extendedState?: Partial<ExtendedState<Partial<S>>>,
        createState?: (state?: Partial<S>) => S,
    ) => ExtendedState<S>;
    createDocument: (
        document?: Partial<ExtendedState<Partial<S>>>,
        createState?: (state?: Partial<S>) => S,
    ) => Document<S, A, M>;
    loadFromFile: (path: string) => Promise<Document<S, A, M>>;
    loadFromInput: (input: FileInput) => Promise<Document<S, A, M>>;
    saveToFile: (
        document: Document<S, A, M>,
        path: string,
        name?: string,
    ) => Promise<string>;
    saveToFileHandle: (
        document: Document<S, A, M>,
        input: FileSystemFileHandle,
    ) => Promise<void>;
};

export type ActionCreator<A extends Action> = // TODO remove any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((input: any) => A)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((input: any, attachments: AttachmentInput[]) => A)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((...input: any) => BaseAction);

export type DocumentModel<
    S = unknown,
    A extends Action = Action,
    M = unknown,
    C extends BaseDocument<S, A, M> = BaseDocument<S, A, M>,
> = {
    Document: DocumentClass<S, A, M, C>;
    reducer: Reducer<S, A>;
    actions: Record<string, ActionCreator<A>>;
    utils: DocumentModelUtils<S, A>;
    documentModel: DocumentModelState;
};

export type EditorContext = {
    theme: 'light' | 'dark';
    debug?: boolean;
};

export type EditorProps<S, A extends Action, M = unknown> = {
    document: Document<S, A, M>;
    dispatch: (action: A | BaseAction) => void;
    editorContext: EditorContext;
};

export type Editor<S = unknown, A extends Action = Action> = {
    Component: FC<EditorProps<S, A>>;
    documentTypes: string[];
};

export type DocumentModelLib = {
    documentModels: DocumentModel[];
    editors: Editor[];
};
