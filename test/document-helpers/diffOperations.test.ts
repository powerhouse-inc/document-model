import { describe, expect, it } from 'vitest';

import {
    diffOperations,
    sortOperations,
    garbageCollect,
} from '../../src/document/utils/document-helpers';

describe('diffOperations', () => {
    const scenarios = [
        {
            title: 'case 1',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
            ],
            operationsB: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
            ],
            expected: [{ index: 2, skip: 0, type: 'OP_2' }],
        },
        {
            title: 'case 2',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
            ],
            operationsB: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
            ],
            expected: [
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
            ],
        },
        {
            title: 'case 3',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
            ],
            operationsB: [
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
            ],
            expected: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 3, skip: 0, type: 'OP_3' },
            ],
        },
        {
            title: 'case 4',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 4, skip: 0, type: 'OP_4' },
                { index: 5, skip: 0, type: 'OP_5' },
            ],
            operationsB: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 5, skip: 0, type: 'OP_5' },
            ],
            expected: [
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 4, skip: 0, type: 'OP_4' },
            ],
        },
    ];

    it.each(scenarios)('should return diff operations: $title', testInput => {
        const result = diffOperations(
            testInput.operationsA,
            testInput.operationsB,
        );

        // console.log(result);
        expect(result.length).toBe(testInput.expected.length);
        expect(result).toMatchObject(testInput.expected);
    });

    const undoScnearios = [
        {
            title: 'case 1',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 4, skip: 1, type: 'OP_4' },
            ],
            operationsB: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 4, skip: 1, type: 'OP_4' },
                { index: 4, skip: 2, type: 'OP_4' },
            ],
            expected: [{ index: 2, skip: 0, type: 'OP_2' }],
        },
        {
            title: 'case 2',
            operationsA: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 4, skip: 1, type: 'OP_4' },
            ],
            operationsB: [
                { index: 0, skip: 0, type: 'OP_0' },
                { index: 1, skip: 0, type: 'OP_1' },
                { index: 2, skip: 0, type: 'OP_2' },
                { index: 3, skip: 0, type: 'OP_3' },
                { index: 4, skip: 1, type: 'OP_4' },
                { index: 4, skip: 2, type: 'OP_4' },
                { index: 5, skip: 0, type: 'OP_5' },
            ],
            expected: [{ index: 2, skip: 0, type: 'OP_2' }],
        },
    ];

    it.each(undoScnearios)(
        'should return diff operations: $title',
        testInput => {
            const result = diffOperations(
                garbageCollect(sortOperations(testInput.operationsA)),
                garbageCollect(sortOperations(testInput.operationsB)),
            );

            expect(result.length).toBe(testInput.expected.length);
            expect(result).toMatchObject(testInput.expected);
        },
    );
});
