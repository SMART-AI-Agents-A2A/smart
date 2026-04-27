import { defineConfig } from 'vite-plus';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { devtools } from '@tanstack/devtools-vite';
import viteReact from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        devtools(),
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
            routesDirectory: './src',
            virtualRouteConfig: './src/routes/routes.ts',
        }),
        viteReact(),
        cloudflare(), // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    ],
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
        },
    },
});
