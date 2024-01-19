import { castDraft, produce } from 'immer';
import {
    loadStateOperation,
    noop,
    pruneOperation,
    redoOperation,
    setNameOperation,
    undoOperation,
} from './actions';
import {
    BaseAction,
    LOAD_STATE,
    PRUNE,
    REDO,
    RedoAction,
    SET_NAME,
    UNDO,
    UndoAction,
} from './actions/types';
import { UndoRedoAction, z } from './schema';
import { Action, Document, ImmutableStateReducer, Operation, ReducerOptions } from './types';
import { isBaseAction, isUndoRedo, hashDocument, replayOperations } from './utils';
import { SignalDispatch } from './signal';

/**
 * Gets the next revision number based on the provided action.
 *
 * @param state The current state of the document.
 * @param action The action being applied to the document.
 * @returns The next revision number.
 */
function getNextRevision(document: Document, action: Action): number {
    const currentRevision = document.revision[action.scope];
    // UNDO, REDO and PRUNE alter the revision themselves
    return [UNDO, REDO, PRUNE].includes(action.type)
        ? currentRevision
        : currentRevision + 1;
}

/**
 * Updates the document header with the latest revision number and
 * date of last modification.
 *
 * @param state The current state of the document.
 * @param action The action being applied to the document.
 * @returns The updated document state.
 */
function updateHeader<T extends Document>(document: T, action: Action): T {
    return {
        ...document,
        revision: {
            ...document.revision,
            [action.scope]: getNextRevision(document, action),
        },
        lastModified: new Date().toISOString(),
    };
}

/**
 * Updates the operations history of the document based on the provided action.
 *
 * @param state The current state of the document.
 * @param action The action being applied to the document.
 * @returns The updated document state.
 */
function updateOperations<T extends Document>(document: T, action: Action, skip = 0): T {
    // UNDO, REDO and PRUNE are meta operations
    // that alter the operations history themselves
    if ([UNDO, REDO, PRUNE].includes(action.type)) {
        return document;
    }

    const { scope } = action;

    // removes undone operations from history if there
    // is a new operation after an UNDO
    const operations = document.operations[scope].slice(
        0,
        document.revision[scope],
    );

    // adds the operation to its scope operations
    operations.push({
        ...action,
        index: operations.length,
        timestamp: new Date().toISOString(),
        hash: '',
        scope,
        skip,
    });

    // adds the action to the operations history with
    // the latest index and current timestamp
    return {
        ...document,
        operations: { ...document.operations, [scope]: operations },
    };
}

/**
 * Updates the document state based on the provided action.
 *
 * @param state The current state of the document.
 * @param action The action being applied to the document.
 * @returns The updated document state.
 */
function updateDocument<T extends Document>(document: T, action: Action, skip = 0) {
    let newDocument = updateOperations(document, action, skip);
    newDocument = updateHeader(newDocument, action);
    return newDocument;
}

/**
 * The base document reducer function that wraps a custom reducer function.
 *
 * @param state The current state of the document.
 * @param action The action being applied to the document.
 * @param wrappedReducer The custom reducer function being wrapped by the base reducer.
 * @returns The updated document state.
 */
function _baseReducer<T, A extends Action, L>(
    document: Document<T, A, L>,
    action: BaseAction,
    wrappedReducer: ImmutableStateReducer<T, A, L>,
): Document<T, A, L> {
    // throws if action is not valid base action
    z.BaseActionSchema().parse(action);

    switch (action.type) {
        case SET_NAME:
            return setNameOperation(document, action.input);
        case UNDO:
            return undoOperation(document, action, wrappedReducer);
        case REDO:
            return redoOperation(document, action, wrappedReducer);
        case PRUNE:
            return pruneOperation(document, action, wrappedReducer);
        case LOAD_STATE:
            return loadStateOperation(document, action.input.state);
        default:
            return document;
    }
}

type UndoRedoProcessResult<T, A extends Action, L> = {
    document: Document<T, A, L>,
    action: A | BaseAction,
    skip: number
};

/**
 * Processes an UNDO or REDO action.
 *
 * @param document The current state of the document.
 * @param action The action being applied to the document.
 * @param skip The number of operations to skip before applying the action.
 * @returns The updated document, calculated skip value and transformed action (if apply).
 */
export function processUndoRedo<T, A extends Action, L>(
    document: Document<T, A, L>,
    action: UndoRedoAction,
    skip: number,
): UndoRedoProcessResult<T, A, L> {
    const scope = action.scope;
    const defaultResult: UndoRedoProcessResult<T, A, L> = {
        document,
        action,
        skip,
    };

    switch (action.type) {
        case UNDO: {
            return produce(defaultResult, draft => {
                if (draft.document.operations[scope].length < 1) {
                    throw new Error(`Cannot undo: no operations in history for scope "${scope}"`);
                }

                if (!draft.action.input || (draft.action as UndoAction).input < 1) {
                    throw new Error(`Invalid UNDO action: input value must be greater than 0`);
                }

                if (draft.skip > 0) {
                    throw new Error(`Cannot undo: skip value from reducer cannot be used with UNDO action`);
                }

                const [ lastOperation ] = draft.document.operations[scope].slice(-1);
                const isLatestOpNOOP = lastOperation.type === 'NOOP' && lastOperation.skip > 0;

                draft.skip += (draft.action as UndoAction).input;

                if (isLatestOpNOOP) {
                    draft.skip += lastOperation.skip;
                    draft.document.operations[scope].pop();
                }

                if (draft.document.operations[scope].length < draft.skip) {
                    throw new Error(`Cannot undo: you can't undo more operations than the ones in the scope history`);
                }

                const operationsLastIndex = draft.document.operations[scope].length - 1;
                let skippedOpsLeft = (draft.action as UndoAction).input;
                let index = isLatestOpNOOP ? operationsLastIndex - lastOperation.skip : operationsLastIndex;

                while (skippedOpsLeft > 0 && index > 0) {
                    const op = draft.document.operations[scope][index];

                    if (op.type === 'NOOP' && op.skip > 0) {
                        index = index - (op.skip + 1);
                        draft.skip += op.skip + 1;
                    } else {
                        draft.document.clipboard.push({ ...op });
                        skippedOpsLeft--;
                        index--;
                    }
                }
                
                draft.action = noop(scope);
            });
        }
            
        case REDO:
            return produce(defaultResult, draft => {
                if (draft.skip > 0) {
                    throw new Error(`Cannot redo: skip value from reducer cannot be used with REDO action`);
                }

                if ((draft.action as RedoAction).input > 1) {
                    throw new Error(`Cannot redo: you can only redo one operation at a time`);
                }

                if ((draft.action as RedoAction).input < 1) {
                    throw new Error(`Invalid REDO action: invalid redo input value`);
                }

                if (draft.document.clipboard.length < 1) {
                    throw new Error(`Cannot redo: no operations in the clipboard`);
                }

                const operationIndex = draft.document.clipboard.findLastIndex((op) => op.scope === scope);
                if (operationIndex < 0) {
                    throw new Error(`Cannot redo: no operations in clipboard for scope "${scope}"`);
                }

                const operation = draft.document.clipboard.splice(operationIndex, 1)[0];

                draft.action = castDraft({
                    type: operation.type,
                    scope: operation.scope,
                    input: operation.input,
                } as A | BaseAction);
            });
        default:
            return defaultResult;
    }
}

/**
 * Base document reducer that wraps a custom document reducer and handles
 * document-level actions such as undo, redo, prune, and set name.
 *
 * @template T - The type of the state of the custom reducer.
 * @template A - The type of the actions of the custom reducer.
 * @param state - The current state of the document.
 * @param action - The action object to apply to the state.
 * @param customReducer - The custom reducer that implements the application logic
 * specific to the document's state.
 * @returns The new state of the document.
 */
export function baseReducer<T, A extends Action, L>(
    document: Document<T, A, L>,
    dispatchedAction: A | BaseAction,
    customReducer: ImmutableStateReducer<T, A, L>,
    dispatch?: SignalDispatch,
    options: ReducerOptions = {},
) {
    const {
        skip,
        ignoreSkipOperations = false,
    } = options;

    let action = { ...dispatchedAction };
    let skipValue = skip || 0;
    let newDocument = document;
    let clipboard = [...document.clipboard];

    if (isUndoRedo(action)) {
        const {
            skip: calculatedSkip,
            action: transformedAction,
            document: processedDocument,
        } = processUndoRedo(document, action, skipValue);

        action = transformedAction;
        skipValue = calculatedSkip;
        newDocument = processedDocument;
        clipboard = [...newDocument.clipboard];
    }

    // if the action is one the base document actions (SET_NAME, UNDO, REDO, PRUNE)
    // then runs the base reducer first
    if (isBaseAction(action)) {
        newDocument = _baseReducer(newDocument, action, customReducer);
    }

    // if the action has a skip value then skips the
    // specified number of operations before applying
    // the action
    if (skipValue > 0 && !ignoreSkipOperations) {
        newDocument = replayOperations(
            newDocument.initialState,
            newDocument.operations,
            customReducer,
            undefined,
            undefined,
            undefined,
            { [action.scope]: skipValue }
        );
    }

    // updates the document revision number, last modified date
    // and operation history
    newDocument = updateDocument(newDocument, action, skipValue);

    // wraps the custom reducer with Immer to avoid
    // mutation bugs and allow writing reducers with
    // mutating code
    newDocument = produce(newDocument, draft => {
        // the reducer runs on a immutable version of
        // provided state
        const returnedDraft = customReducer(draft.state, action as A, dispatch);
        const clipboardValue = isUndoRedo(dispatchedAction) ? [...clipboard] : [];

        // if the reducer creates a new state object instead
        // of mutating the draft then returns the new state
        if (returnedDraft) {
            // casts new state as draft to comply with typescript
            return castDraft<Document<T, A, L>>({
                ...newDocument,
                clipboard: [...clipboardValue],
                state: returnedDraft,
            });
        } else {
            draft.clipboard = castDraft([...clipboardValue]);
        }
    });

    // updates the document history
    return produce(newDocument, draft => {
        // meta operations are not added to the operations history
        if ([UNDO, REDO, PRUNE].includes(action.type)) {
            return draft;
        }

        // updates the last operation with the hash of the resulting state
        const scope = action.scope || 'global';
        draft.operations[scope][draft.operations[scope].length - 1].hash =
            hashDocument(draft, scope);

        // if the action has attachments then adds them to the document
        if (!isBaseAction(action) && action.attachments) {
            action.attachments.forEach(attachment => {
                const { hash, ...file } = attachment;
                draft.attachments[hash] = {
                    ...file,
                };
            });
        }
    });
}
