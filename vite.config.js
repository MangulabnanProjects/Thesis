import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as Minio from 'minio'

// MinIO client — connects directly to local MinIO (no ngrok needed)
const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'gveQxfiE1VEfzBF01O8P',
  secretKey: '56gE6QSeYWH4KOfYS3j4YISMQQuEG5VSBr6bptkD',
})

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'minio-audio-stream',
      configureServer(server) {
        // Stream audio directly from MinIO to the browser
        // URL: /api/audio?path=Jasper_Mangulabnan/Jasper_Mangulabnan_0-03.m4a
        server.middlewares.use(async (req, res, next) => {
          // Only handle /api/audio requests
          if (!req.url.startsWith('/api/audio')) {
            return next()
          }

          try {
            // Parse query params from the full URL
            const url = new URL(req.url, 'http://localhost')
            const objectPath = url.searchParams.get('path')

            if (!objectPath) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing path parameter' }))
              return
            }

            console.log(`[MinIO Stream] Fetching: ${objectPath}`)

            // Get file info for content-type
            const stat = await minioClient.statObject('audio-recordings', objectPath)
            const ext = objectPath.split('.').pop().toLowerCase()
            const contentType = ext === 'wav' ? 'audio/wav'
              : ext === 'm4a' ? 'audio/mp4'
              : ext === 'mp4' ? 'audio/mp4'
              : ext === 'mp3' ? 'audio/mpeg'
              : 'application/octet-stream'

            // Read the entire file into a buffer (files are small — KBs)
            const stream = await minioClient.getObject('audio-recordings', objectPath)
            const chunks = []
            for await (const chunk of stream) {
              chunks.push(chunk)
            }
            const buffer = Buffer.concat(chunks)

            console.log(`[MinIO Stream] Sending ${buffer.length} bytes (${contentType})`)

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': buffer.length,
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=3600',
            })
            res.end(buffer)
          } catch (err) {
            console.error('[MinIO Stream] Error:', err.message)
            if (!res.headersSent) {
              res.writeHead(err.code === 'NotFound' ? 404 : 500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: err.message }))
            }
          }
        })
      },
    },
  ],
  server: {
    host: true,
  },
})
