import { replaceBrowserModules } from './vite.config';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => {
    const isBrowser = process.env.VITE_TARGET === 'browser';
    return {
        test: {
            globals: true,
            browser: {
                enabled: isBrowser,
                headless: true,
                name: 'chrome',
            },
        },
        plugins: [isBrowser && replaceBrowserModules()],
    };
});
