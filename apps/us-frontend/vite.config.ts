import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    {
      name: 'python-bridge',
      configureServer(server) {
        server.middlewares.use('/_scripts/okx/verify', async (req, res) => {
          const chunks: Uint8Array[] = []
          await new Promise<void>((resolve) => {
            req.on('data', (c) => chunks.push(c))
            req.on('end', () => resolve())
          })
          const raw = Buffer.concat(chunks).toString('utf-8')
          let body: any = {}
          try { body = JSON.parse(raw || '{}') } catch {}
          const userId = String(body?.userId || 'default')
          const ordId = String(body?.ordId || '')
          const instId = String(body?.instId || '')
          const keys = body?.keys || {}
          if (!ordId || !instId || !keys?.apiKey || !keys?.secretKey || !keys?.passphrase) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: '缺少必要参数', message: '请检查密钥、订单号与交易对' }))
            return
          }
          const env = {
            OKX_API_KEY: String(keys.apiKey),
            OKX_SECRET_KEY: String(keys.secretKey),
            OKX_PASSPHRASE: String(keys.passphrase),
            OKX_UID: String(keys.uid || ''),
            // 兼容两种命名，脚本将择优读取
            ORD_ID: ordId,
            ORDER_ID: ordId,
            INST_ID: instId,
            // 允许通过环境配置基础URL或模拟盘
            OKX_BASE_URL: process.env.OKX_BASE_URL || 'https://www.okx.com',
            OKX_SIMULATED: process.env.OKX_SIMULATED || '',
          }
          const py = spawn('python3', ['scripts/okx_verify.py'], { env: { ...process.env, ...env } })
          let stdout = ''
          let stderr = ''
          py.stdout.on('data', (d) => { stdout += d.toString('utf-8') })
          py.stderr.on('data', (d) => { stderr += d.toString('utf-8') })
          py.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json')
            if (code === 0 && stdout.trim()) {
              res.statusCode = 200
              res.end(stdout)
            } else {
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, error: stderr || '脚本执行失败', message: '验证失败' }))
            }
          })
        })

        server.middlewares.use(async (req, res, next) => {
          const url = req.url || ''
          if (!url.startsWith('/mock/')) return next()
          const root = process.env.TEST_DATA_DIR?.trim() || path.resolve(process.cwd(), '..', '..')
          const send404 = () => { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 'NOT_FOUND' })) }
          const sendJson = (buf: Buffer) => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(buf) }
          const sendText = (buf: Buffer, type: string) => { res.statusCode = 200; res.setHeader('Content-Type', type); res.end(buf) }
          if (url.startsWith('/mock/orders/')) {
            const id = decodeURIComponent(url.slice('/mock/orders/'.length)).replace(/\?.*$/, '')
            const candidates = [
              path.join(root, 'reports', `order_${id}_detailed_report.json`),
              path.join(root, `order_${id}_detailed_report.json`),
            ]
            for (const p of candidates) {
              try { const buf = await fs.readFile(p); return sendJson(buf) } catch {}
            }
            return send404()
          }
          if (url.startsWith('/mock/evidence/')) {
            const parts = url.slice('/mock/evidence/'.length).replace(/\?.*$/, '').split('/')
            if (parts.length < 2) return send404()
            const dir = parts[0]
            const file = parts.slice(1).join('/')
            const p = path.join(root, 'reports', 'evidence', dir, file)
            try {
              const buf = await fs.readFile(p)
              const ext = path.extname(file).toLowerCase()
              if (ext === '.json') return sendJson(buf)
              if (ext === '.csv') return sendText(buf, 'text/csv')
              return sendText(buf, 'text/plain')
            } catch {}
            return send404()
          }
          next()
        })
      }
    },
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react'
    })
  ],
  // 资源基址配置 - 支持通过环境变量配置，默认根路径
  base: process.env.BASE_URL || '/',
  server: {
    port: 5173,
    host: true,
    // 使用Vite默认HMR配置，不移除任何默认设置
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/mock': {
        target: process.env.VITE_API_BASE || process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // 只定义必要的环境变量，避免全局污染
  define: {
    // 仅提供NODE_ENV给需要的库，避免定义全局process.env
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
