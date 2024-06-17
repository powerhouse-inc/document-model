import { Plugin, defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import generateFile from 'vite-plugin-generate-file';

export function replaceBrowserModules(): Plugin {
    return {
        name: 'replace-browser-modules',
        async resolveId(source, importer, options) {
            if (source.endsWith('/node')) {
                const resolvedId = await this.resolve(
                    source,
                    importer,
                    options,
                );
                return {
                    ...resolvedId,
                    id: resolvedId!.id.replace('node.ts', 'browser.ts'),
                };
            }
        },
        enforce: 'pre',
    };
}

const entry = {
    index: 'src/index.ts',
    'document-model': 'src/document-model/index.ts',
    document: 'src/document/index.ts',
};

// eslint-disable-next-line no-empty-pattern
export default defineConfig(({ mode }) => {
    const target = process.env.VITE_TARGET ?? 'node';
    const isBrowser = target === 'browser';
    const external = ['mutative', 'jszip', 'mime', 'zod'];

    // if building for node then don't polyfill node core modules
    if (!isBrowser) {
        external.push('path', 'crypto', 'fs', 'https');
    }

    return {
        build: {
            outDir: `dist/${target}`,
            emptyOutDir: true,
            lib: {
                entry,
                formats: ['es', 'cjs'],
            },
            rollupOptions: {
                external,
                output: {
                    entryFileNames: '[format]/[name].js',
                    chunkFileNames: '[format]/internal/[name]-[hash].js',
                    exports: 'named',
                },
            },
            sourcemap: true,
            minify: mode === 'production',
        },
        optimizeDeps: {
            include: isBrowser ? ['sha.js/sha1', 'sha.js/sha256'] : [],
        },
        plugins: [
            isBrowser ? replaceBrowserModules() : undefined,
            dts({ insertTypesEntry: true }),
            generateFile([
                {
                    type: 'json',
                    output: './es/package.json',
                    data: {
                        type: 'module',
                    },
                },
                {
                    type: 'json',
                    output: `./cjs/package.json`,
                    data: {
                        type: 'commonjs',
                    },
                },
            ]),
        ],
    };
});
