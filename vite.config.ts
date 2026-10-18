import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/chuka-comrades/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'chuka-crest-192.png',
        'chuka-crest-512.png',
      ],
      manifest: {
        name: 'Chuka Comrades',
        short_name: 'Chuka Comrades',
        description: 'The Chuka Comrades campus community.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/chuka-comrades/',
        scope: '/chuka-comrades/',
        icons: [
          {
            src: 'chuka-crest-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'chuka-crest-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
