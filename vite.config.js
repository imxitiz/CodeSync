import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
            },
          },
        ],
        // Skip waiting and claim clients immediately
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['logo.ico', 'logo.png', 'mainlogo.png'],
      manifest: {
        name: 'CodeSync - Real-time Code Collaboration',
        short_name: 'CodeSync',
        description: 'A real-time collaborative code editor for seamless team programming',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a1a',
        theme_color: '#4aee88',
        orientation: 'any',
        scope: '/',
        lang: 'en',
        categories: ['productivity', 'developer', 'collaboration'],
        icons: [
          {
            src: '/logo.ico',
            sizes: '16x16 32x32 48x48',
            type: 'image/x-icon',
          },
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/mainlogo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        shortcuts: [
          {
            name: 'Create New Room',
            short_name: 'New Room',
            description: 'Create a new collaborative coding room',
            url: '/?action=new-room',
            icons: [
              {
                src: '/logo.png',
                sizes: '192x192',
                type: 'image/png',
              },
            ],
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in development
      },
    }),
  ],
  // SSG configuration
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
