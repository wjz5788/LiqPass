import "dotenv/config"
import process from "node:process"
import axios from "axios"
import { ApiKeyEncryptionService } from "../src/utils/crypto.js"

type CliArgs = {
  userId: string
  orderId: string
  instId?: string
  ordRef?: string
  confirm?: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string | boolean> = {}
  for (let i = 2; i < argv.length; i++) {
    const cur = argv[i]
    if (cur === "--confirm") { args.confirm = true; continue }
    if (cur.startsWith("--")) {
      const key = cur.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith("--")) throw new Error(`参数 ${cur} 缺少值`)
      args[key] = next
      i++
    }
  }
  const userId = String((args.user ?? args.u ?? "")).trim()
  const orderId = String((args.ord ?? args.order ?? "")).trim()
  const instId = (args.pair ?? args.instId) as string | undefined
  const ordRef = (args.ordRef ?? args.orderRef) as string | undefined
  const confirm = Boolean(args.confirm)
  if (!userId) throw new Error("缺少必填参数：--user <userId>")
  if (!orderId) throw new Error("缺少必填参数：--ord <orderId>")
  return { userId, orderId, instId, ordRef, confirm }
}

function resolveInstId(raw?: string): string {
  const v = (raw || "BTCUSDT").trim().toUpperCase()
  const mapping: Record<string, string> = {
    BTCUSDT: "BTC-USDT-SWAP",
    "BTC-USDT": "BTC-USDT-SWAP",
    "BTC-USDT-SWAP": "BTC-USDT-SWAP",
    BTCUSDC: "BTC-USDC-SWAP",
    "BTC-USDC": "BTC-USDC-SWAP",
    "BTC-USDC-SWAP": "BTC-USDC-SWAP",
  }
  const instId = mapping[v]
  if (!instId) throw new Error(`当前脚本只支持 btcusdt / btcusdc（收到: ${v}），请用 --pair btcusdt 或 --pair btcusdc`)
  return instId
}

function backendBase(): string {
  return process.env.BACKEND_BASE_URL || "http://127.0.0.1:3002"
}

function verifyPath(): string {
  return process.env.VERIFY_PATH || "/api/v1/verify/okx"
}

function confirmPath(): string {
  return process.env.VERIFY_CONFIRM_PATH || "/api/v1/verify/confirm"
}

function jpBase(): string {
  return process.env.JP_VERIFY_BASE_URL || process.env.JP_VERIFY_BASE || "http://127.0.0.1:8082"
}

async function getUserOkxKeys(userId: string): Promise<{ apiKey: string; secretKey: string; passphrase: string }> {
  const envApi = (process.env.OKX_API_KEY || '').trim()
  const envSec = (process.env.OKX_SECRET_KEY || '').trim()
  const envPass = (process.env.OKX_PASSPHRASE || '').trim()
  if (envApi && envSec && envPass) {
    return { apiKey: envApi, secretKey: envSec, passphrase: envPass }
  }
  const { default: dbManager } = await import("../src/database/db.js")
  const db = dbManager.getDatabase()
  let row: any
  try {
    row = db.get(`SELECT * FROM api_keys WHERE user_id = ? AND exchange = ? ORDER BY updated_at DESC LIMIT 1`, userId, "okx")
  } catch {}
  if (!row) throw new Error("未找到用于验证的API密钥（也未在环境变量中提供 OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE）")
  const dec = ApiKeyEncryptionService.decryptApiKey(row.api_key_enc, row.secret_enc, row.passphrase_enc)
  return { apiKey: dec.api_key, secretKey: dec.secret, passphrase: dec.passphrase }
}

async function main() {
  const startedAt = Date.now()
  const args = parseArgs(process.argv)
  if (String(process.env.JP_VERIFY_TEST_MODE || '').trim() === '1') {
    const instId = resolveInstId(args.instId || 'BTCUSDT')
    const ordRef = (args.ordRef || '').trim() || 'ordRef_demo'
    const evidenceId = `evi_${Date.now().toString(16)}`
    const out = {
      evidenceId,
      instId,
      ordId: ordRef,
      isLiquidated: true,
      shouldPayout: true,
      payoutSuggestUsd: 48.5,
      costMs: 5,
      status: 'verified'
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2))
    return
  }
  const baseUrl = backendBase()
  const vPath = verifyPath()
  const cPath = confirmPath()
  const instId = resolveInstId(args.instId || process.env.CLAIM_DEFAULT_SYMBOL || "BTCUSDT")
  if (!args.ordRef) throw new Error("当前脚本要求显式传入交易所订单号：--ordRef <ordRef>")
  const ordRef = args.ordRef.trim()
  const adminApiKey = process.env.ADMIN_API_KEY
  const keys = await getUserOkxKeys(args.userId)

  const url = `${baseUrl}${vPath}`
  let res: any
  try {
    res = await axios.post(url, {
      exchange: "okx",
      ordId: ordRef,
      instId,
      live: true,
      fresh: true,
      noCache: true,
      keyMode: "inline",
      apiKey: keys.apiKey,
      secretKey: keys.secretKey,
      passphrase: keys.passphrase,
      clientMode: "full",
      uid: undefined,
      keyAlias: undefined,
    }, {
      headers: {
        "Content-Type": "application/json",
        ...(adminApiKey ? { "x-admin-api-key": adminApiKey } : {}),
      },
      timeout: 45000,
    })
  } catch (err) {
    const jb = jpBase()
    res = await axios.post(`${jb}/api/verify`, {
      exchange: "okx",
      ordId: ordRef,
      instId,
      live: true,
      fresh: true,
      noCache: true,
      keyMode: "inline",
      apiKey: keys.apiKey,
      secretKey: keys.secretKey,
      passphrase: keys.passphrase,
      clientMeta: { source: "claimsVerifyRunner", requestId: `${Date.now()}` }
    }, { headers: { "Content-Type": "application/json" }, timeout: 45000 })
  }

  const data = res.data as any
  const costMs = Date.now() - startedAt
  const evidenceId = data?.evidenceId || data?.normalized?.evidence_id || null
  const isLiquidated = data?.is_liquidated ?? (data?.normalized?.data?.liq_flag === "true" || data?.normalized?.position?.liquidated === true) ?? null
  const eligible = data?.eligible_for_purchase ?? null
  const payoutSuggestUsd = data?.payoutSuggestUsd ?? null

  const out = {
    evidenceId,
    instId: data?.meta?.instId || instId,
    ordId: data?.meta?.ordId || ordRef,
    isLiquidated,
    shouldPayout: eligible,
    payoutSuggestUsd,
    costMs,
    status: data?.status || (data?.verifyStatus ? (data.verifyStatus === "PASS" ? "verified" : "failed") : undefined)
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2))

  if (args.confirm && evidenceId) {
    const cu = `${baseUrl}${cPath}`
    try {
      await axios.post(cu, { evidenceId, kind: "script_trigger", orderId: args.orderId, ordId: ordRef, instId }, { headers: { "Content-Type": "application/json", ...(adminApiKey ? { "x-admin-api-key": adminApiKey } : {}) }, timeout: 15000 })
    } catch {}
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("脚本异常退出：", err?.message || String(err))
  process.exit(1)
})
