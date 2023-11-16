import type { Document, ExtendedState } from '../../document/types';
import { DocumentModelMeta, type DocumentModelState } from './schema/types';
import type { DocumentModelAction } from './actions';

export { z } from './schema';
export type * from './schema/types';
export type ExtendedDocumentModelState = ExtendedState<DocumentModelState>;
export type DocumentModelDocument = Document<
    DocumentModelState,
    DocumentModelAction,
    DocumentModelMeta
>;
export { DocumentModelState, DocumentModelAction };
