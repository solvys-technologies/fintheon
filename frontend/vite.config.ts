import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(() => {
  const plugins = [tailwindcss(), react()]

  if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    const releaseName =
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      'local-dev'
    
    plugins.push(
      sentryVitePlugin({
        org: process.env.SENTRY_ORG!,
        project: process.env.SENTRY_PROJECT!,
        authToken: process.env.SENTRY_AUTH_TOKEN!,
        release: {
          name: releaseName
        }
      } as any)
    )
  }

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname)
      }
    },
    plugins,
    build: {
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          'mini-widget': path.resolve(__dirname, 'mini-widget.html')
        },
        output: {
          manualChunks: {
            vendor_react: ['react', 'react-dom'],
            vendor_sentry: ['@sentry/react'],
            vendor_clerk: ['@clerk/clerk-react', '@clerk/themes'],
            vendor_markdown: ['react-markdown'],
            vendor_tv: ['react-ts-tradingview-widgets']
          }
        }
      },
      outDir: 'dist'
    },
    // Use '/' for Vercel, './' for Electron
    base: process.env.VERCEL ? '/' : './',
    server: {
      cors: true,
      port: 7777
    },
    define: {
      // Inject build timestamp so each build has a unique version
      'import.meta.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
    }
  }
})
