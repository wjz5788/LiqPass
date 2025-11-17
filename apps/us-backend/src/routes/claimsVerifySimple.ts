import express from 'express'
import { z } from 'zod'
import AuthService from '../services/authService.js'
import { createEnhancedAuthMiddleware } from '../middleware/enhancedAuth.js'
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'
import { runOrderVerifyWithStoredApi } from '../services/claimsVerifySimpleService.js'

const schema = z.object({
  orderId: z.string().min(1),
  ordRef: z.string().min(1),
  pair: z.enum(['btcusdt', 'btcusdc']).optional()
})

function getCurrentUserId(req: express.Request): string | null {
  const auth = (req as any).auth
  if (auth && auth.authInfo && auth.authInfo.type === 'user') {
    return String(auth.authInfo.id || '')
  }
  if (auth && typeof auth.userId === 'string') {
    return String(auth.userId)
  }
  return null
}

function getCurrentWallet(req: express.Request): string | null {
  const auth = (req as any).auth
  const p = auth?.authInfo?.profile
  const w = p?.walletAddress || ''
  return w ? String(w).toLowerCase() : null
}

export default function claimsVerifySimpleRoutes(authService: AuthService) {
  const router = express.Router()
  const enhancedAuth = createEnhancedAuthMiddleware(authService)
  const claimAuth = enhancedAuth.claimAuth()

  if (String(process.env.JP_VERIFY_TEST_MODE || '').trim() !== '1') {
    router.post('/verify-by-order', claimAuth, async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = schema.parse(req.body)
        const userId = getCurrentUserId(req)
        if (!userId) {
          return res.status(401).json({ error: 'UNAUTHORIZED' })
        }
        const wallet = getCurrentWallet(req)
        if (!wallet) {
          return res.status(400).json({ error: 'WALLET_REQUIRED' })
        }

        const result = await runOrderVerifyWithStoredApi({
          userId,
          wallet,
          orderId: parsed.orderId,
          ordRef: parsed.ordRef,
          pair: parsed.pair ?? 'btcusdt'
        })

        res.json(result)
      } catch (err) {
        next(err)
      }
    })
  }

  return router
}
