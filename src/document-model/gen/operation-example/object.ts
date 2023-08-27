import { BaseDocument } from '../../../document/object';

import {
    AddOperationExampleInput,
    UpdateOperationExampleInput,
    DeleteOperationExampleInput,
    ReorderOperationExamplesInput,
    DocumentModelState
} from '../types';
import {
    addOperationExample,
    updateOperationExample,
    deleteOperationExample,
    reorderOperationExamples,
} from './creators';
import { DocumentModelAction } from '../actions';

export default class DocumentModel_OperationExample extends BaseDocument<
    DocumentModelState, DocumentModelAction
> {
    public addOperationExample(input: AddOperationExampleInput) {
        return this.dispatch(addOperationExample(input));
    }
    
    public updateOperationExample(input: UpdateOperationExampleInput) {
        return this.dispatch(updateOperationExample(input));
    }
    
    public deleteOperationExample(input: DeleteOperationExampleInput) {
        return this.dispatch(deleteOperationExample(input));
    }
    
    public reorderOperationExamples(input: ReorderOperationExamplesInput) {
        return this.dispatch(reorderOperationExamples(input));
    }
    
}