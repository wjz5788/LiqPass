import React, { useEffect, useState } from "react";
import { OrderCardData, ChainName } from "../types/order";
import { getExplorerTxUrl } from "../lib/explorer";

// =============================
// 工具函数
// =============================

const toMs = (time: number | string): number => {
  if (time == null) return NaN;
  if (typeof time === "number") {
    return time < 1e12 ? time * 1000 : time;
  }
  const n = Number(time);
  if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
  const d = new Date(time).getTime();
  return Number.isFinite(d) ? d : NaN;
};

const fmtDate = (ts: number | string) => {
  const ms = toMs(ts);
  if (!Number.isFinite(ms)) return String(ts);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
};

const num = (n: number, p = 2) => {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: p, maximumFractionDigits: p });
};

const getTxUrl = (chain: ChainName, tx: string) => {
  return getExplorerTxUrl({ chainId: null, txHash: (tx || "").trim() });
};

const shortRef = (ref: string) => {
  const s = String(ref || "");
  if (!s) return "-";
  return s.length > 12 ? s.slice(0, 4) + "…" + s.slice(-4) : s;
};

// 取消演示数据：仅展示后端返回的真实记录或本地购买记录

// =============================
// 子组件：订单卡
// =============================



type OrderStatus = "ACTIVE" | "PENDING" | "EXPIRED";

interface Order {
  id: string;
  productName: string;
  status: OrderStatus;
  premiumUsd: number;
  maxPayoutUsd: number;
  remainSeconds: number;
  txHash?: string | null;
}

function formatCountdown(seconds: number) {
  const h = Math.max(0, Math.floor(seconds / 3600));
  const m = Math.max(0, Math.floor((seconds % 3600) / 60));
  const s = Math.max(0, seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const BilingualOrderCard: React.FC<{ order: Order }> = ({ order }) => {
  const statusLabel =
    order.status === "ACTIVE"
      ? "生效中 / Active"
      : order.status === "PENDING"
      ? "待生效 / Pending"
      : "已结束 / Expired";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 px-6 py-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-lg font-semibold text-slate-900">{order.productName}</div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{statusLabel}</span>
          {order.status === "ACTIVE" && (
            <span className="text-[11px] text-emerald-600">{formatCountdown(order.remainSeconds)}</span>
          )}
        </div>
        <div className="ml-auto text-right text-slate-900">
          <div className="text-base font-semibold">${order.maxPayoutUsd.toFixed(2)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">最大赔付金额 / Max payout</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-slate-500">已付保费 / Premium paid</div>
          <div className="text-base font-semibold text-slate-900">${order.premiumUsd.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 flex flex-col gap-1">
          <div className="text-xs text-slate-500">剩余时间 / Remaining time</div>
          <div className="text-base font-semibold text-slate-900">{order.status === "ACTIVE" ? formatCountdown(order.remainSeconds) : '—'}</div>
        </div>
      </div>

      {order.txHash && (
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href={getExplorerTxUrl({ chainId: null, txHash: order.txHash })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            查看链上交易 / View on explorer
          </a>
        </div>
      )}
    </div>
  );
};

// =============================
// 主组件
// =============================

interface OrdersPageProps {
  apiBase?: string;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ apiBase = "" }) => {
  const [walletAddr, setWalletAddr] = useState<string>("");
  try {
    const w = (window as any)?.ethereum;
    const src = Array.isArray(w?.providers) ? w.providers.find((p: any) => p?.isMetaMask || p?.request) : w;
    if (src?.request) {
      src.request({ method: "eth_accounts" }).then((accounts: string[]) => setWalletAddr((accounts?.[0] || "").toLowerCase())).catch(() => {});
    }
  } catch {}
  const ORDERS_URL = apiBase ? `${apiBase.replace(/\/$/, "")}/orders/my?address=${walletAddr}` : `/api/v1/orders/my?address=${walletAddr}`;

  // 数据与加载态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [rows, setRows] = useState<OrderCardData[]>([]);

  // 每秒 tick 触发重渲染以更新倒计时
  const [tick, setTick] = useState(0);
  useEffect(() => { 
    const timer = setInterval(() => setTick((v) => v + 1), 1000); 
    return () => clearInterval(timer); 
  }, []);

  // 拉取列表
  const refresh = async () => {
    if (!walletAddr) {
      console.log('[OrdersPage] walletAddress empty, skip /orders/my');
      setRows([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(ORDERS_URL, { method: "GET" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      const list: any[] = Array.isArray(data?.orders) ? data.orders : Array.isArray(data) ? data : [];
      const normalized: OrderCardData[] = list.map((r: any, i: number) => {
        const created = r.createdAt ?? r.created_at ?? new Date().toISOString();
        const startTs = r.coverageStartTs ?? r.coverage_start_ts ?? created;
        const endTs = r.coverageEndTs ?? r.coverage_end_ts ?? (r.skuId === 'sku_24h_liq' ? new Date(new Date(created).getTime() + 24 * 3600_000).toISOString() : created);
        const premium6d = Number(r.premiumUSDC6d ?? r.premium_usdc_6d ?? 0);
        const payout6d = Number(r.payoutUSDC6d ?? r.payout_usdc_6d ?? 0);
        return ({
        id: r.id ?? r.orderId ?? `${Date.now()}-${i}`,
        title: r.title ?? "24h 爆仓保",
        principal: Number(r.principal ?? 0),
        leverage: Number(r.leverage ?? 0),
        premiumPaid: premium6d > 0 ? premium6d / 1_000_000 : Number(r.premiumPaid ?? r.premiumUSDC ?? r.premium ?? 0),
        payoutMax: payout6d > 0 ? payout6d / 1_000_000 : Number(r.payoutMax ?? r.payoutUSDC ?? 0),
        status: String(r.status ?? "active"),
        coverageStartTs: startTs,
        coverageEndTs: endTs,
        createdAt: created,
        orderRef: r.orderRef ?? r.order_ref ?? "",
        exchangeAccountId: r.exchangeAccountId ?? r.exchange_account_id ?? r.exchange,
        chain: r.chain ?? "Base",
        txHash: String(r.paymentTx ?? r.txHash ?? r.tx_hash ?? "").trim(),
        orderDigest: r.orderDigest ?? r.order_digest ?? "",
        skuId: r.skuId ?? r.sku_id ?? "SKU_24H_FIXED",
      });
      });
      // 按 createdAt desc
      normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      let localArr: OrderCardData[] = [];
      try {
        const raw = localStorage.getItem("lp_local_orders") || "[]";
        const arr = JSON.parse(raw);
        localArr = Array.isArray(arr) ? arr : [];
      } catch {}
      const merged = [...localArr, ...normalized].filter((v, idx, arr) => {
        const key = String(v?.id || "") + "|" + String(v?.txHash || "");
        return idx === arr.findIndex(w => (String(w?.id || "") + "|" + String(w?.txHash || "")) === key);
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRows(merged);
    } catch (e: any) {
      console.warn("/orders failed:", e?.message || e);
      setError("");
      try {
        const raw = localStorage.getItem("lp_local_orders") || "[]";
        const arr = JSON.parse(raw);
        const localArr: OrderCardData[] = Array.isArray(arr) ? arr : [];
        const sorted = localArr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(sorted);
      } catch {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [apiBase, walletAddr]);

  const total = rows.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-2">订单管理 / Orders</h1>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        在这里查看你的保单订单，并跟踪状态。<br />
        View all your policy orders here and track their status.
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((o) => {
          const endMs = toMs(o.coverageEndTs);
          const remainSec = Number.isFinite(endMs) ? Math.max(0, Math.floor((endMs - Date.now()) / 1000)) : 0;
          const status: OrderStatus = (o.status === "pending_onchain")
            ? "PENDING"
            : (o.status === "expired" || remainSec <= 0)
            ? "EXPIRED"
            : "ACTIVE";
          const order = {
            id: o.id,
            productName: o.title || "24h 爆仓保",
            status,
            premiumUsd: o.premiumPaid,
            maxPayoutUsd: o.payoutMax,
            remainSeconds: remainSec,
            txHash: o.txHash || null,
          };
          return <BilingualOrderCard key={o.id} order={order} />;
        })}
        {rows.length === 0 && !loading && (
          <div className="text-sm text-gray-400">暂无订单 / No orders yet.</div>
        )}
        {loading && (
          <div className="text-sm text-gray-500">加载中 / Loading…</div>
        )}
        {error && (
          <div className="text-sm text-red-600">加载失败：{error}</div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
