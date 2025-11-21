import React, { useEffect, useState } from "react";
import { authFetchJson } from "../lib/authFetch";
import { getAuthAddress } from "../lib/auth";
import { pythonScriptService, ScriptVerifyResult } from "../services/pythonScriptService";

type ClaimStatus = "PENDING" | "VERIFIED" | "PAID";

interface ClaimOrder {
  id: string;
  productName: string;
  principalUsd: number;
  leverage: string;
  premiumUsd: number;
  payoutMaxUsd: number;
  purchaseTime: string;
  orderRef: string;
  latestAccount: string;
  remainingSeconds: number;
  status: ClaimStatus;
}

interface VerifyResult {
  orderRef: string;
  exchange: string | null;
  symbol: string | null;
  side?: string | null;
  size?: number | null;
  isLiquidated: boolean | null;
  pnl?: number | null;
  liquidationTime: string | null;
  evidenceId: string | null;
  readyForPayoutAt: string | null;
  payoutSuggest?: number | null;
  orderRaw?: any;
  fills?: any[];
}

function formatCountdown(seconds: number) {
  const h = Math.max(0, Math.floor(seconds / 3600));
  const m = Math.max(0, Math.floor((seconds % 3600) / 60));
  const s = Math.max(0, seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function readLocalOrders(): ClaimOrder[] {
  let arr: any[] = [];
  try {
    const raw = localStorage.getItem("lp_local_orders") || "[]";
    const json = JSON.parse(raw);
    arr = Array.isArray(json) ? json : [];
  } catch {}
  const now = Date.now();
  return arr.map((o: any) => {
    const endMs = Number(new Date(o.coverageEndTs).getTime());
    const remainSec = Number.isFinite(endMs) ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0;
    return {
      id: String(o.id || ""),
      productName: String(o.title || "24h 爆仓保"),
      principalUsd: Number(o.principal || 0),
      leverage: `${Number(o.leverage || 0)}x`,
      premiumUsd: Number(o.premiumPaid || 0),
      payoutMaxUsd: Number(o.payoutMax || 0),
      purchaseTime: new Date(o.createdAt || Date.now()).toLocaleString(),
      orderRef: String(o.orderRef || ""),
      latestAccount: String(o.exchangeAccountId || ""),
      remainingSeconds: remainSec,
      status: "PENDING",
    };
  });
}

export default function ClaimsManagePage() {
  const [orders, setOrders] = useState<ClaimOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderRefInput, setOrderRefInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const addr = getAuthAddress();
        const url = addr ? `/api/v1/claims/my?address=${encodeURIComponent(addr)}` : "/api/v1/claims/my";
        const data = await authFetchJson<any>(url, { method: "GET" });
        const items = Array.isArray(data?.claims) ? data.claims : [];
        const mapped: ClaimOrder[] = items.map((c: any) => {
          const endMs = Number(new Date(c.coverageEnd).getTime());
          const remainSec = Number.isFinite(endMs) ? Math.max(0, Math.floor((endMs - Date.now()) / 1000)) : 0;
          const premiumUsd = typeof c.premium_usdc_6d === "number" ? c.premium_usdc_6d / 1_000_000 : Number(c.premiumPaid || 0);
          const payoutMaxUsd = typeof c.payout_usdc_6d === "number" ? c.payout_usdc_6d / 1_000_000 : Number(c.payoutCap || 0);
          const principalUsd = typeof c.principal_usdc_6d === "number" ? c.principal_usdc_6d / 1_000_000 : Number(c.principal || 0);
          const status: ClaimStatus = c.status === "paid"
            ? "PAID"
            : (c.verifiedAt || c.evidenceId) ? "VERIFIED" : "PENDING";
          return {
            id: String(c.orderId || ""),
            productName: String(c.title || "24h 爆仓保"),
            principalUsd,
            leverage: `${Number(c.leverage || 0)}x`,
            premiumUsd,
            payoutMaxUsd,
            purchaseTime: new Date(c.orderCreatedAt || c.createdAt || Date.now()).toLocaleString(),
            orderRef: String(c.orderRef || ""),
            latestAccount: String(c.accountRef || ""),
            remainingSeconds: remainSec,
            status,
          };
        });
        setOrders(mapped);
      } catch (err) {
        console.error("加载赔付订单失败", err);
        try {
          const local = readLocalOrders();
          setOrders(local);
        } catch {}
      }
    };
    fetchClaims();
    const timer = setInterval(() => {
      setOrders((prev) => prev.map((o) => ({ ...o, remainingSeconds: Math.max(0, o.remainingSeconds - 1) })));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleOpenVerify = (order: ClaimOrder) => {
    setExpandedOrderId(order.id);
    setOrderRefInput(order.orderRef || "");
    setVerifyResult(null);
    setError(null);
    try { if (order.latestAccount) pythonScriptService.setCurrentUser(order.latestAccount); } catch {}
  };

  const handleVerify = async () => {
    if (!expandedOrderId || !orderRefInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const ordId = orderRefInput.trim();
      const res = await fetch(`/mock/orders/${encodeURIComponent(ordId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || '验证失败');
      }
      const info = data?.order_info || {};
      const fills = Array.isArray(data?.fills_analysis) ? data.fills_analysis : [];
      const liqs = Array.isArray(data?.liquidations) ? data.liquidations : [];
      const risk = data?.risk_assessment || {};
      const symbol = info['交易对'] || null;
      const side = info['方向'] || null;
      const sizeStr = info['成交数量'] || info['订单数量'] || null;
      const sizeNum = typeof sizeStr === 'string' ? Number(sizeStr) : (typeof sizeStr === 'number' ? sizeStr : null);
      const isLiq = (Array.isArray(liqs) && liqs.length > 0) || Boolean(risk['是否有强平风险']);
      const liqTime = Array.isArray(liqs) && liqs[0]?.['时间'] ? new Date(liqs[0]['时间']).toISOString() : null;
      const mappedFills = fills.map((f: any) => ({
        ts: f['时间'] ? new Date(f['时间']).getTime() : undefined,
        side: f['方向'] || undefined,
        fillPx: f['价格'] || undefined,
        fillSz: f['数量'] || undefined,
        fillPnl: f['盈亏'] || undefined,
        fee: f['手续费'] || undefined,
        tradeId: f['成交ID'] || undefined,
      }));
      const result: VerifyResult = {
        orderRef: ordId,
        exchange: 'OKX',
        symbol,
        side,
        size: Number.isFinite(sizeNum) ? sizeNum : null,
        isLiquidated: isLiq,
        pnl: typeof risk['累计盈亏'] === 'number' ? risk['累计盈亏'] : null,
        liquidationTime: liqTime,
        evidenceId: null,
        readyForPayoutAt: isLiq ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
        payoutSuggest: isLiq ? Number((risk['强平损失'] ?? 0)) : null,
        orderRaw: data,
        fills: mappedFills,
      };
      setVerifyResult(result);
      if (result.isLiquidated) {
        setOrders((prev) => prev.map((o) => (o.id === expandedOrderId ? { ...o, status: 'VERIFIED' } : o)));
      }
    } catch (e: any) {
      setError(e?.message || '验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (order: ClaimOrder) => {
    try {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "PAID" } : o)));
    } catch {
      alert("标记赔付失败，请稍后重试");
    }
  };

  const refresh = async () => {
    try {
      const addr = getAuthAddress();
      const url = addr ? `/api/v1/claims/my?address=${encodeURIComponent(addr)}` : "/api/v1/claims/my";
      const data = await authFetchJson<any>(url, { method: "GET" });
      const items = Array.isArray(data?.claims) ? data.claims : [];
      const mapped: ClaimOrder[] = items.map((c: any) => {
        const endMs = Number(new Date(c.coverageEnd).getTime());
        const remainSec = Number.isFinite(endMs) ? Math.max(0, Math.floor((endMs - Date.now()) / 1000)) : 0;
        const premiumUsd = typeof c.premium_usdc_6d === "number" ? c.premium_usdc_6d / 1_000_000 : Number(c.premiumPaid || 0);
        const payoutMaxUsd = typeof c.payout_usdc_6d === "number" ? c.payout_usdc_6d / 1_000_000 : Number(c.payoutCap || 0);
        const principalUsd = typeof c.principal_usdc_6d === "number" ? c.principal_usdc_6d / 1_000_000 : Number(c.principal || 0);
        const status: ClaimStatus = c.status === "paid"
          ? "PAID"
          : (c.verifiedAt || c.evidenceId) ? "VERIFIED" : "PENDING";
        return {
          id: String(c.orderId || ""),
          productName: String(c.title || "24h 爆仓保"),
          principalUsd,
          leverage: `${Number(c.leverage || 0)}x`,
          premiumUsd,
          payoutMaxUsd,
          purchaseTime: new Date(c.orderCreatedAt || c.createdAt || Date.now()).toLocaleString(),
          orderRef: String(c.orderRef || ""),
          latestAccount: String(c.accountRef || ""),
          remainingSeconds: remainSec,
          status,
        };
      });
      setOrders(mapped);
    } catch (err) {
      console.error("刷新赔付订单失败", err);
      try {
        const local = readLocalOrders();
        setOrders(local);
      } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF7ED] text-[#3F2E20]">
      <div className="sticky top-16 z-10 bg-[#FFF7EDF2] border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-yellow-400 border border-gray-100" />
            <div className="font-semibold">赔付管理 / Claims</div>
            <div className="text-sm text-gray-500">倒序 · 共 {orders.length} 笔 / Desc · {orders.length} items</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              刷新 / Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid gap-3">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="font-semibold">{order.productName}</div>
                <div className="flex gap-2 flex-wrap text-sm">
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                    <span className="text-slate-500">Principal</span>
                    <span className="text-slate-900">${order.principalUsd.toFixed(2)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                    <span className="text-slate-500">Leverage</span>
                    <span className="text-slate-900">{order.leverage}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                    <span className="text-slate-500">Premium</span>
                    <span className="text-slate-900">${order.premiumUsd.toFixed(2)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                    <span className="text-slate-500">Payout Max</span>
                    <span className="text-slate-900">${order.payoutMaxUsd.toFixed(2)}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {order.status === "PENDING" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">待验证 / Pending · T-{formatCountdown(order.remainingSeconds)}</span>
                )}
                {order.status === "VERIFIED" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">已验证 / Verified · T-{formatCountdown(order.remainingSeconds)}</span>
                )}
                {order.status === "PAID" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">已赔付 / Paid</span>
                )}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-600">
              <div className="flex gap-2">
                <span className="text-gray-500">购买时间 / Purchase time</span>
                <span>{order.purchaseTime}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">订单号 / Order Ref</span>
                <span className="font-mono">{order.orderRef || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">最近验单账号 / Latest account</span>
                <span className="font-mono">{order.latestAccount || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">倒计时 / Countdown</span>
                <span> T-{formatCountdown(order.remainingSeconds)}</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenVerify(order)}
                disabled={order.status === "PAID"}
              >
                验证 / Verify
              </button>
              <button
                className={`px-3 py-2 rounded-lg border transition-colors ${
                  order.status === "VERIFIED"
                    ? "bg-white border-gray-200 hover:bg-gray-50 text-gray-900"
                    : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                onClick={() => handleMarkPaid(order)}
                disabled={order.status !== "VERIFIED"}
              >
                标记已赔付 / Mark as paid
              </button>
              <button className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                详情 / Details
              </button>
            </div>
            {expandedOrderId === order.id && (
              <div className="mt-3 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900">对该保单进行交易所验证 / Verify on exchange</div>
                    <div className="text-xs text-gray-400">仅验证此保单绑定账户下的订单 / Only orders under bound account</div>
                </div>

                {/* 已保存API密钥提示 */}
                {pythonScriptService.hasApiKeys() && (
                  <div className="mt-2 rounded-lg border border-green-200 bg-green-50/40 p-3">
                    <div className="text-xs text-green-700 font-medium">✓ 已保存 API 密钥 / Saved API keys</div>
                    <div className="text-xs text-green-600 mt-1">只需输入订单号，交易对将使用已保存的固定交易对 / Enter orderRef only; instId defaults to saved one</div>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-gray-500">交易所订单号 / Order Ref</label>
                    <input
                      value={orderRefInput}
                      onChange={(e) => setOrderRefInput(e.target.value)}
                      placeholder={'例如：2940071038556348417 / e.g., 2940071038556348417'}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={loading || !orderRefInput.trim()}
                    className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? ('验证中… / Verifying…') : ('验证 / Verify')}
                  </button>
                </div>

                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

                {verifyResult && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">验证结果 / Verify Result</div>
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-[11px] text-yellow-800">已验证 · 待放款（T+24h） / Verified · Pending payout (T+24h)</span>
                    </div>
                    <dl className="mt-3 grid gap-1 text-xs text-gray-600">
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">交易所订单号 / Order Ref</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.orderRef}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">交易所 / Exchange</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.exchange || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">币对 / Pair</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.symbol || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">方向 / Side</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.side || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">数量 / Size</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.size ?? '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">是否清算 / Liquidated</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.isLiquidated ? "是" : "否"}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">盈亏 / PnL</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.pnl ?? '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">爆仓时间 / Liquidation time</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.liquidationTime || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">证据 ID / Evidence ID</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.evidenceId || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">可放款时间 / Ready for payout at</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.readyForPayoutAt || '-'}</dd>
                      </div>
                      {typeof verifyResult.payoutSuggest === 'number' && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">建议赔付金额 / Suggested payout</dt>
                          <dd className="font-medium text-gray-900">{verifyResult.payoutSuggest} USDC</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-2 text-[11px] text-gray-400">系统已保存证据与订单号，24 小时后由人工复核与放款 / Evidence saved; manual review and payout in 24h.</p>
                    <p className="mt-1 text-[11px] text-gray-500">仅验证此保单绑定账户下的订单 / Only orders under the bound account are verified.</p>
                    {((import.meta as any).env?.VITE_DEMO_MODE === '1') ? (
                      <p className="mt-1 text-[11px] text-gray-500">当前为演示模式，结果用于界面联调；如需真实查询请在设置中配置 API 密钥并关闭演示模式 / Demo mode; configure API keys and disable demo for real verification.</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-gray-500">若未发生清算则不予赔付；如有异议可提交补充证据以便人工复核 / No payout if not liquidated; submit evidence for review if disputed.</p>
                    )}
                    {verifyResult.orderRaw && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-gray-900">订单原始信息 / Raw order info</div>
                        <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(verifyResult.orderRaw, null, 2)}</pre>
                      </div>
                    )}
                    {Array.isArray(verifyResult.fills) && verifyResult.fills.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-medium text-gray-900">成交记录 / Fills</div>
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-gray-500">
                                <th className="py-1 pr-4">时间 / Time</th>
                                <th className="py-1 pr-4">方向 / Side</th>
                                <th className="py-1 pr-4">价格 / Price</th>
                                <th className="py-1 pr-4">数量 / Qty</th>
                                <th className="py-1 pr-4">盈亏 / PnL</th>
                                <th className="py-1 pr-4">手续费 / Fee</th>
                                <th className="py-1 pr-4">成交ID / Trade ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {verifyResult.fills.map((f: any, idx: number) => (
                                <tr key={idx} className="border-t border-gray-100">
                                  <td className="py-1 pr-4">{f.ts ? new Date(Number(f.ts)).toLocaleString() : '-'}</td>
                                  <td className="py-1 pr-4">{f.side || '-'}</td>
                                  <td className="py-1 pr-4">{f.fillPx || '-'}</td>
                                  <td className="py-1 pr-4">{f.fillSz || '-'}</td>
                                  <td className="py-1 pr-4">{typeof f.fillPnl === 'string' || typeof f.fillPnl === 'number' ? f.fillPnl : '-'}</td>
                                  <td className="py-1 pr-4">{typeof f.fee === 'string' || typeof f.fee === 'number' ? f.fee : '-'}</td>
                                  <td className="py-1 pr-4 font-mono">{f.tradeId || f.billId || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {orders.length === 0 && (
          <div className="p-6 bg-white border border-gray-200 rounded-xl text-gray-500 text-center">暂无记录 / No records</div>
        )}
      </div>
    </div>
  );
}
