import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

// tests run in a US Pacific timezone so DST weeks are exercised
if (process.env.VITEST) process.env.TZ = process.env.TZ || 'America/Los_Angeles';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const build = process.env.VITE_BUILD === 'public' ? 'public' : 'gift';
const base = process.env.BASE_PATH || '/';

/** Exposes which manifest slots have final art in /public/assets, so the game never requests missing files. */
function assetIndex(): Plugin {
  const id = 'virtual:asset-index';
  const resolved = '\0' + id;
  const pngSize = (file: string): [number, number] => {
    const b = fs.readFileSync(file);
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };
  const scan = () => {
    const manifest = JSON.parse(fs.readFileSync('assets/manifest.json', 'utf8')) as { id: string; path: string; frames: number }[];
    const ids: string[] = [];
    const frames: Record<string, number[]> = {};
    const sizes: Record<string, [number, number]> = {};
    for (const e of manifest) {
      const file = path.join('public', e.path);
      if (fs.existsSync(file)) {
        ids.push(e.id);
        sizes[e.id] = pngSize(file);
      }
      for (let f = 0; f < Math.max(4, e.frames); f++) {
        const ff = file.replace(/\.png$/, `_f${f}.png`);
        if (fs.existsSync(ff)) {
          (frames[e.id] ??= []).push(f);
          sizes[`${e.id}#f${f}`] = pngSize(ff);
        }
      }
    }
    return { ids, frames, sizes };
  };
  return {
    name: 'asset-index',
    resolveId: (src) => (src === id ? resolved : null),
    load: (src) => (src === resolved ? `export default ${JSON.stringify(scan())};` : null),
    configureServer(server) {
      server.watcher.add(path.resolve('public/assets'));
      const refresh = (file: string) => {
        if (!file.includes(`${path.sep}public${path.sep}assets${path.sep}`)) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_KIND__: JSON.stringify(build),
  },
  resolve: {
    alias: {
      '@personal': path.resolve(build === 'public' ? 'content/personal/public.json' : 'content/personal/personal.json'),
    },
  },
  plugins: [
    preact(),
    assetIndex(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'placeholders/*.png', 'assets/**/*.png', 'audio/**/*.ogg'],
      manifest: {
        name: 'Selleck Homestead',
        short_name: 'Homestead',
        description: 'A cozy farm game. Clear the brambles, raise Highland cows, and bring the old farm back to life.',
        theme_color: '#4A2B7A',
        background_color: '#2B1B3D',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff,woff2,ogg,json,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    // hashed bundles go to /static so they never mix with final art in /assets
    assetsDir: 'static',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    alias: { '@personal': path.resolve('content/personal/personal.json') },
  },
} as Parameters<typeof defineConfig>[0]);
