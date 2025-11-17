import React, { useEffect, useState } from "react";
import { authFetchJson } from "../lib/authFetch";
import { getAuthAddress } from "../lib/auth";

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
  };

  const handleVerify = async () => {
    if (!expandedOrderId || !orderRefInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const prepareResp = await authFetchJson<any>("/api/v1/claims/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: expandedOrderId }),
      });
      const claimId = String(prepareResp?.claimId || "").trim();
      if (!claimId) throw new Error("后端未返回 claimId");

      const data = await authFetchJson<any>("/api/v1/claims/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, orderRef: orderRefInput.trim() }),
      });

      const result: VerifyResult = {
        orderRef: String(data.orderRef || orderRefInput.trim()),
        exchange: data.exchange ?? null,
        symbol: data.symbol ?? null,
        side: data.side ?? null,
        size: data.size ?? null,
        isLiquidated: Boolean(data.isLiquidated ?? false),
        pnl: data.pnl ?? null,
        liquidationTime: data.liquidationTime ?? null,
        evidenceId: data.evidenceId ?? null,
        readyForPayoutAt: data.payoutEligibleAt ?? null,
        payoutSuggest: data.payoutSuggest ?? null,
      };

      setVerifyResult(result);

      if (result.isLiquidated) {
        setOrders((prev) => prev.map((o) => (o.id === expandedOrderId ? { ...o, status: "VERIFIED" } : o)));
      }
    } catch (e: any) {
      setError(e?.message || "验证失败");
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
            <div className="font-semibold">赔付管理</div>
            <div className="text-sm text-gray-500">倒序 · 共 {orders.length} 笔</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              刷新
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
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    待验证 · T-{formatCountdown(order.remainingSeconds)}
                  </span>
                )}
                {order.status === "VERIFIED" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    待放款 · T-{formatCountdown(order.remainingSeconds)}
                  </span>
                )}
                {order.status === "PAID" && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">已赔付</span>
                )}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-600">
              <div className="flex gap-2">
                <span className="text-gray-500">购买时间</span>
                <span>{order.purchaseTime}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">订单号</span>
                <span className="font-mono">{order.orderRef || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">最近验单账号</span>
                <span className="font-mono">{order.latestAccount || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">倒计时</span>
                <span> T-{formatCountdown(order.remainingSeconds)}</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenVerify(order)}
                disabled={order.status === "PAID"}
              >
                验证
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
                标记已赔付
              </button>
              <button className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                详情
              </button>
            </div>
            {expandedOrderId === order.id && (
              <div className="mt-3 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">对该保单进行交易所验证</div>
                  <div className="text-xs text-gray-400">仅验证此保单绑定账户下的订单</div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-gray-500">交易所订单号 orderRef</label>
                    <input
                      value={orderRefInput}
                      onChange={(e) => setOrderRefInput(e.target.value)}
                      placeholder="例如：2940071038556348417"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={loading || !orderRefInput.trim()}
                    className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "验证中…" : "验证"}
                  </button>
                </div>

                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

                {verifyResult && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">验证结果</div>
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-[11px] text-yellow-800">已验证 · 待放款（T+24h）</span>
                    </div>
                    <dl className="mt-3 grid gap-1 text-xs text-gray-600">
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">交易所订单号</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.orderRef}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">交易所</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.exchange || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">币对</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.symbol || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">方向</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.side || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">数量</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.size ?? '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">是否清算</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.isLiquidated ? "是" : "否"}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">PnL</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.pnl ?? '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">爆仓时间</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.liquidationTime || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">证据 ID</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.evidenceId || '-'}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">可放款时间</dt>
                        <dd className="font-medium text-gray-900">{verifyResult.readyForPayoutAt || '-'}</dd>
                      </div>
                      {typeof verifyResult.payoutSuggest === 'number' && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-gray-500">建议赔付金额</dt>
                          <dd className="font-medium text-gray-900">{verifyResult.payoutSuggest} USDC</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-2 text-[11px] text-gray-400">系统已保存证据与订单号，24 小时后由人工复核与放款。</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {orders.length === 0 && (
          <div className="p-6 bg-white border border-gray-200 rounded-xl text-gray-500 text-center">暂无记录</div>
        )}
      </div>
    </div>
  );
}
