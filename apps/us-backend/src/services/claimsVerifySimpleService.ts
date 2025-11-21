import dbManager from '../database/db.js'
import { ApiKeyEncryptionService } from '../utils/crypto.js'
import { evidenceStorage } from '../utils/evidenceStorage.js'
import * as jpVerifyClient from './jpVerifyClient.js'

export async function runOrderVerifyWithStoredApi(input: {
  userId: string
  wallet?: string
  orderId: string
  ordRef: string
  pair: 'btcusdt' | 'btcusdc'
}): Promise<{
  orderId: string
  ordRef: string
  instId: string
  isLiquidated: boolean
  verifyStatus: string
  payoutSuggestUsd?: number | null
  evidenceRef?: string | null
  raw?: any
}> {
  const db = dbManager.getDatabase()

  const orderRow = db.get('SELECT id, wallet_address FROM orders WHERE id = ?', input.orderId) as any
  if (!orderRow) {
    throw new Error('ORDER_NOT_FOUND')
  }
  const walletNorm = (input.wallet || orderRow.wallet_address || '').toLowerCase()
  if (!walletNorm || walletNorm !== String(orderRow.wallet_address || '').toLowerCase()) {
    throw new Error('ORDER_NOT_BELONG_TO_WALLET')
  }

  const apiKeyRow = db.get(
    'SELECT * FROM api_keys WHERE user_id = ? AND exchange = ? ORDER BY created_at DESC LIMIT 1',
    input.userId,
    'okx'
  ) as any
  if (!apiKeyRow) {
    throw new Error('OKX_API_MISSING')
  }

  const decrypted = ApiKeyEncryptionService.decryptApiKey(
    apiKeyRow.api_key_enc,
    apiKeyRow.secret_enc,
    apiKeyRow.passphrase_enc
  )

  const instId = input.pair === 'btcusdt' ? 'BTC-USDT-SWAP' : 'BTC-USDC-SWAP'

  const request = {
    exchange: 'okx',
    ordId: input.ordRef,
    instId,
    keyMode: 'inline' as const,
    apiKey: decrypted.api_key,
    secretKey: decrypted.secret,
    passphrase: decrypted.passphrase,
    clientMeta: { source: 'us-backend', requestId: input.orderId }
  }

  const response = await jpVerifyClient.verifyStandard(request, 30000)
  const data = response.data as any

  const evidenceId = evidenceStorage.generateEvidenceId()
  const evidenceData = {
    evidenceId,
    request,
    response: data,
    timestamp: new Date().toISOString(),
    status: response.status
  }
  let evidenceRef: string | null = null
  try {
    evidenceRef = evidenceStorage.saveEvidence(evidenceId, evidenceData)
  } catch {}

  try {
    const id = `vrf_${input.orderId}_${Date.now()}`
    const normalized = JSON.stringify(data?.normalized || null)
    const checks = JSON.stringify({})
    const evidence = JSON.stringify(data?.evidence || null)
    const perf = JSON.stringify(data?.perf || null)
    const errorJson = JSON.stringify(data?.error || null)
    const nowIso = new Date().toISOString()
    const verdict = data?.verifyStatus === 'PASS' ? 'pass' : 'fail'
    db.run(
      `INSERT INTO verify_results (
        id, order_id, user_id, exchange, ord_id, inst_id,
        normalized_json, checks_json, evidence_id, evidence_json, perf_json,
        verdict, error_json, verified_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.orderId,
      input.userId,
      'okx',
      String(input.ordRef),
      String(instId),
      normalized,
      checks,
      String(evidenceId),
      evidence,
      perf,
      verdict,
      errorJson,
      nowIso,
      nowIso
    )
  } catch {}

  return {
    orderId: input.orderId,
    ordRef: input.ordRef,
    instId,
    isLiquidated: Boolean(data?.isLiquidated ?? data?.normalized?.data?.liq_flag === 'true'),
    verifyStatus: String(data?.verifyStatus || (data?.isLiquidated ? 'PASS' : 'FAIL')),
    payoutSuggestUsd: data?.payoutSuggestUsd ?? null,
    evidenceRef,
    raw: data
  }
}

