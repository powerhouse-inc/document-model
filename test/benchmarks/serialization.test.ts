import { sjs, attr } from 'slow-json-stringify';
import safeStableStr from 'safe-stable-stringify';
import path from 'path';
import avro from 'avsc';
import protobuf from 'protobufjs';
import testDrive from '../document-model/test-drive.json';
import { hash } from '../../src/document/utils/node';

function formatT(t: number) {
    return Math.round(t * 1000) / 1000;
}

function average(values: number[]) {
    return values.reduce(function (avg, value, _, { length }) {
        return avg + value / length;
    }, 0);
}

const callInfoSchema = {
    type: 'record',
    name: 'CallInfo',
    fields: [
        { name: 'data', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'transmitterType', type: 'string' },
    ],
};

const filterSchema = {
    type: 'record',
    name: 'Filter',
    fields: [
        { name: 'branch', type: { type: 'array', items: 'string' } },
        { name: 'documentId', type: { type: 'array', items: 'string' } },
        { name: 'documentType', type: { type: 'array', items: 'string' } },
        { name: 'scope', type: { type: 'array', items: 'string' } },
    ],
};

const listenerSchema = {
    type: 'record',
    name: 'Listener',
    fields: [
        { name: 'callInfo', type: callInfoSchema },
        { name: 'system', type: 'boolean' },
        { name: 'listenerId', type: 'string' },
        { name: 'filter', type: filterSchema },
        { name: 'block', type: 'boolean' },
        { name: 'label', type: 'string' },
    ],
};

const operationSchema = {
    type: 'record',
    name: 'Operation',
    fields: [{ name: 'listener', type: listenerSchema }],
};

const listenerAvro = avro.Type.forSchema(operationSchema);
// const listenerAvro = avro.Type.forValue(testDrive.operations.local[0].input);

const stringifyListener = sjs({
    listener: {
        callInfo: {
            data: attr('string'),
            name: attr('string'),
            transmitterType: attr('string'),
        },
        system: attr('boolean'),
        listenerId: attr('string'),
        filter: {
            branch: attr('array'),
            documentId: attr('array'),
            documentType: attr('array'),
            scope: attr('array'),
        },
        block: attr('boolean'),
        label: attr('string'),
    },
});

const root = protobuf.loadSync(path.join(__dirname, './listener.proto'));
const opProto = root.lookupType('Operation');

type Method = {
    name: string;
    stringify: (value: any) => string;
    parse: (value: any) => JSON;
    hash?: (value: any) => string;
};

const methods: Method[] = [
    {
        name: 'JSON',
        stringify: JSON.stringify,
        parse: JSON.parse,
    },
    {
        name: 'safe-stable-stringify',
        stringify: safeStableStr,
        parse: JSON.parse,
    },
    {
        name: 'slow-json-stringify',
        stringify: stringifyListener,
        parse: JSON.parse,
    },
    {
        name: 'protobuf',
        stringify(value: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return opProto.encode(value).finish();
        },
        parse(value: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return opProto.decode(value).toJSON();
        },
    },
    {
        name: 'avro',
        stringify(value: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return listenerAvro.toBuffer(value);
        },
        parse(value: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
            return listenerAvro.fromBuffer(value);
        },
    },
];

type Timings = {
    Total: string;
    Stringify: string;
    Parse: string;
    Hash: string;
};

describe('DocumentModel Serialization', () => {
    const timingsFull: Record<string, Timings> = {};

    const timingsOperations: Record<string, Timings> = {};

    afterAll(() => {
        console.info('Full document');
        console.table(timingsFull);

        console.info('Operations');
        console.table(timingsOperations);
    });

    it('should serialize and deserialize correctly', () => {
        const start = performance.now();
        const str = JSON.stringify(testDrive);
        const stringify = performance.now();
        const obj = JSON.parse(str);
        const end = performance.now();
        hash(str);
        const hashing = performance.now();

        const total = formatT(end - start);
        const stringifyT = formatT(stringify - start);
        const parseT = formatT(end - stringify);
        const hashT = formatT(hashing - end);
        timingsFull.JSON = {
            Total: `${total}ms`,
            Stringify: `${stringifyT}ms`,
            Parse: `${parseT}ms`,
            Hash: `${hashT}ms`,
        };

        expect(obj).toStrictEqual(testDrive);
    });

    it.each(methods)(
        'should serialize and deserialize operations with $name',
        (testInput: Method) => {
            // warmup
            testDrive.operations.local.map(value =>
                testInput.parse(testInput.stringify(value.input)),
            );
            testDrive.operations.local.map(value =>
                testInput.parse(testInput.stringify(value.input)),
            );

            const totals = [];
            const stringifies = [];
            const parses = [];
            const hashes = [];
            for (let i = 0; i < 10; i++) {
                const operations = testDrive.operations.local.slice(1);
                const operationsStr = [];
                const operationsObj = [];

                const start = performance.now();
                for (const operation of operations) {
                    operationsStr.push(testInput.stringify(operation.input));
                }
                const stringify = performance.now();

                for (const operation of operationsStr) {
                    operationsObj.push(testInput.parse(operation));
                }

                const end = performance.now();
                for (const str of operationsStr) {
                    hash(str);
                }
                const hashing = performance.now();

                const total = end - start;
                const stringifyT = stringify - start;
                const parseT = end - stringify;
                const hashT = hashing - end;

                totals.push(total);
                stringifies.push(stringifyT);
                parses.push(parseT);
                parses.push(parseT);
                hashes.push(hashT);

                if (testInput.name !== 'avro') {
                    expect(operationsObj).toStrictEqual(
                        operations.map(o => o.input),
                    );
                }
            }

            console.log('Totals', testInput.name, totals.map(formatT));
            const total = formatT(average(totals));
            const stringifyT = formatT(average(stringifies));
            const parseT = formatT(average(parses));
            const hashT = formatT(average(hashes));
            timingsOperations[testInput.name] = {
                Total: `${total}ms`,
                Stringify: `${stringifyT}ms`,
                Parse: `${parseT}ms`,
                Hash: `${hashT}ms`,
            };
        },
    );

    it('should not serialize and deserialize deterministically with JSON', () => {
        const inputA = {
            listener: {
                callInfo: {
                    data: '',
                    name: 'Interal',
                    transmitterType: 'Internal',
                },
                system: true,
                listenerId: 'real-world-assets',
                filter: {
                    branch: ['main'],
                    documentId: ['*'],
                    documentType: [
                        'makerdao/rwa-portfolio',
                        'powerhouse/document-drive',
                    ],
                    scope: ['*'],
                },
                block: false,
                label: 'real-world-assets',
            },
        };

        const inputB = {
            listener: {
                system: true,
                callInfo: {
                    transmitterType: 'Internal',
                    name: 'Interal',
                    data: '',
                },
                block: false,
                filter: {
                    documentType: [
                        'makerdao/rwa-portfolio',
                        'powerhouse/document-drive',
                    ],
                    branch: ['main'],
                    scope: ['*'],
                    documentId: ['*'],
                },
                label: 'real-world-assets',
                listenerId: 'real-world-assets',
            },
        };

        const strA = JSON.stringify(inputA);
        const strB = JSON.stringify(inputB);
        const valueA = JSON.parse(strA);
        const valueB = JSON.parse(strB);

        expect(valueA).toStrictEqual(valueB);
        const hashA = hash(strA);
        const hashB = hash(strB);
        expect(hashA).not.toStrictEqual(hashB);
    });

    it.each(methods.filter(m => m.name !== 'JSON'))(
        'should serialize and deserialize deterministically with $name',
        (testInput: Method) => {
            const inputA = {
                listener: {
                    callInfo: {
                        data: '',
                        name: 'Interal',
                        transmitterType: 'Internal',
                    },
                    system: true,
                    listenerId: 'real-world-assets',
                    filter: {
                        branch: ['main'],
                        documentId: ['*'],
                        documentType: [
                            'makerdao/rwa-portfolio',
                            'powerhouse/document-drive',
                        ],
                        scope: ['*'],
                    },
                    block: false,
                    label: 'real-world-assets',
                },
            };

            const inputB = {
                listener: {
                    system: true,
                    callInfo: {
                        transmitterType: 'Internal',
                        name: 'Interal',
                        data: '',
                    },
                    block: false,
                    filter: {
                        documentType: [
                            'makerdao/rwa-portfolio',
                            'powerhouse/document-drive',
                        ],
                        branch: ['main'],
                        scope: ['*'],
                        documentId: ['*'],
                    },
                    label: 'real-world-assets',
                    listenerId: 'real-world-assets',
                },
            };

            const strA = testInput.stringify(inputA);
            const strB = testInput.stringify(inputB);
            const valueA = testInput.parse(strA);
            const valueB = testInput.parse(strB);
            expect(valueA).toStrictEqual(valueB);

            const hashA = testInput.hash?.(inputA) ?? hash(strA);
            const hashB = testInput.hash?.(inputA) ?? hash(strB);
            expect(hashA).toStrictEqual(hashB);
        },
    );
});
