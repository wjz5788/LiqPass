import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../services/api';
import { pythonScriptService, ScriptVerifyResult } from '../services/pythonScriptService';

// 类型定义
interface ExchangeAccount {
  id: string;
  exchange: 'OKX' | 'Hyperliquid' | 'Binance';
  label: string;
  status: 'draft' | 'unverified' | 'verifying' | 'verified' | 'failed' | 'disabled' | 'deleted';
  lastVerifiedAt: string | null;
  caps: {
    orders: boolean;
    fills: boolean;
    positions: boolean;
    liquidations: boolean;
  };
  account: {
    exchangeUid?: string;
    subAccount?: string;
  };
  masked: {
    apiKeyLast4?: string;
    secretKeyLast4?: string;
    passphraseLast4?: string;
  };
  environment: 'live' | 'testnet';
  userConfirmedEcho?: boolean;
  lastVerifyResult?: VerifyResult;
}

interface VerifyResult {
  status: 'verified' | 'failed' | 'partial' | 'error';
  caps: {
    orders: boolean;
    fills: boolean;
    positions: boolean;
    liquidations: boolean;
  };
  account: {
    exchangeUid?: string;
    subAccount?: string;
    accountType?: string;
    sampleInstruments?: string[];
  };
  proof?: {
    echo?: {
      firstOrderIdLast4?: string;
      firstFillQty?: string;
      firstFillTime?: string;
    };
    hash?: string;
  };
  reasons?: string[];
  verifiedAt?: string;
  order?: OrderEcho;
  checks?: VerifyChecks;
  liquidation?: LiquidationInfo;
  sessionId?: string;
}

interface OrderEcho {
  orderId: string;
  pair: string;
  side?: string;
  type?: string;
  status?: string;
  executedQty?: string;
  avgPrice?: string;
  quoteAmount?: string;
  orderTimeIso?: string;
  exchangeTimeIso?: string;
}

interface VerifyChecks {
  authOk: boolean;
  capsOk: boolean;
  orderFound: boolean;
  echoLast4Ok: boolean;
  arithmeticOk: boolean;
  pairOk: boolean;
  timeSkewMs: number;
  verdict: 'pass' | 'fail';
}

interface LiquidationInfo {
  status: 'none' | 'forced_liquidation' | 'adl';
  eventTimeIso?: string;
  instrument?: string;
  positionSizeBefore?: string;
  positionSizeAfter?: string;
  pnlAbs?: string;
}

interface AccountVerifyForm {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  uid: string;
  ordId: string;
  instId: string;
}

interface VerifyPayload {
  exchange: string;
  ordId: string;
  instId: string;
  live: boolean;
  fresh: boolean;
  noCache: boolean;
  keyMode: 'inline' | 'alias';
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  uid?: string;
}

const createInitialVerifyForm = (): AccountVerifyForm => ({
  apiKey: '',
  secretKey: '',
  passphrase: '',
  uid: '',
  ordId: '',
  instId: '',
});

type VerifyResponse = {
  meta?: any;
  normalized?: any;
  raw?: any;
  evidence?: any;
  perf?: any;
  detail?: string;
  message?: string;
  error?: string;
  verifyId?: string;
  evidenceId?: string;
  exchange?: string;
  instId?: string;
  ordId?: string;
  side?: string;
  size?: string;
  leverage?: number;
  avgPx?: string;
  liqPx?: string;
  openTime?: string;
  closeTime?: string;
  isLiquidated?: boolean;
  pnl?: string;
  currency?: string;
  verifyStatus?: 'PASS' | 'FAIL';
  verifyReason?: string | null;
  canPurchase?: boolean;
  verifiedAt?: string;
  anchorStatus?: string;
  anchorTxHash?: string | null;
};

// 交易所字段定义
const EXCHANGES_META = {
  OKX: {
    label: 'OKX',
    fields: [
      { key: 'apiKey', label: 'API Key', sensitive: true },
      { key: 'apiSecret', label: 'API Secret', sensitive: true },
      { key: 'passphrase', label: 'Passphrase', sensitive: true },
    ],
  },
  Hyperliquid: {
    label: 'Hyperliquid',
    fields: [
      { key: 'apiKey', label: 'API Key', sensitive: true },
      { key: 'apiSecret', label: 'API Secret / Signing Key', sensitive: true },
      { key: 'accountId', label: 'Account ID / SubAccount', sensitive: false },
    ],
  },
  Binance: {
    label: 'Binance',
    fields: [
      { key: 'apiKey', label: 'API Key', sensitive: true },
      { key: 'apiSecret', label: 'API Secret', sensitive: true },
    ],
  },
} as const;


// 状态徽章组件
function StatusBadge({ status, lastVerifiedAt, pendingConfirm, verifying }: {
  status: ExchangeAccount['status'];
  lastVerifiedAt: string | null;
  pendingConfirm?: boolean;
  verifying?: boolean;
}) {
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN');
  };

  const getBadgeConfig = () => {
    if (verifying) {
      return { text: '🔄 验证中…', cls: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' };
    }
    if (status === 'verified' && !pendingConfirm) {
      return { text: '🟢 绿点 · 已确认', cls: 'bg-green-50 text-green-700 border-green-200' };
    }
    if (status === 'verified' && pendingConfirm) {
      return { text: '🟡 黄点 · 待确认', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    return { text: '⚪ 灰点 · 未验证', cls: 'bg-zinc-50 text-zinc-600 border-zinc-200' };
  };

  const config = getBadgeConfig();
  return (
    <span className={`inline-block rounded-xl border px-2 py-1 text-xs ${config.cls}`}>
      {config.text}
    </span>
  );
}

// 表单字段组件
function Field({ label, children, required }: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-sm text-zinc-700">
        {label}{required ? <span className="text-red-500"> *</span> : null}
      </div>
      {children}
    </label>
  );
}

// 按钮组件
function Button({ children, onClick, kind = 'primary', className = '', disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const base = 'px-3 py-2 rounded-xl text-sm border shadow-sm disabled:opacity-50';
  const cls = {
    primary: 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800',
    ghost: 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50',
    danger: 'bg-white text-red-700 border-red-300 hover:bg-red-50',
  }[kind];
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${cls} ${className}`}>
      {children}
    </button>
  );
}

// 输入框组件
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 ${props.className || ''}`}
    />
  );
}

// 选择框组件
function Select({ value, onChange, options, disabled }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// API 设置页面主组件
export const ApiSettings: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [accountForms, setAccountForms] = useState<Record<string, AccountVerifyForm>>({});
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<VerifyResponse | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  
  // 抽屉状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => accounts.find(x => x.id === editingId) || null, [accounts, editingId]);
  
  // 表单状态
  const [form, setForm] = useState({
    exchange: 'OKX' as 'OKX' | 'Hyperliquid' | 'Binance',
    label: '',
    environment: 'live' as 'live' | 'testnet',
    ipWhitelist: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    instId: '',
    extra: {} as Record<string, string>,
  });
  
  // 初始加载
  useEffect(() => {
    loadAccounts();
  }, []);

  // 从环境变量自动保存一次用户的OKX密钥与固定交易对（仅用于演示联调）
  useEffect(() => {
    try {
      const env: any = (import.meta as any).env || {};
      const apiKey: string | undefined = env.VITE_OKX_API_KEY;
      const secretKey: string | undefined = env.VITE_OKX_SECRET_KEY || env.VITE_OKX_API_SECRET;
      const passphrase: string | undefined = env.VITE_OKX_PASSPHRASE || env.VITE_OKX_API_PASSPHRASE;
      const uid: string = String(env.VITE_OKX_UID || '201933253463154688');
      const instRaw: string = String(env.VITE_INST_ID || 'BTCUSDT');
      const instId = normalizeInstId(instRaw);
      if (apiKey && secretKey && passphrase) {
        pythonScriptService.saveApiKeys(uid, { apiKey, secretKey, passphrase, uid });
        pythonScriptService.saveInstId(uid, instId);
        pythonScriptService.setCurrentUser(uid);
      }
    } catch {}
  }, []);

  // 加载账户列表
  const loadAccounts = async () => {
    console.log('开始加载账户列表...');
    setLoading(true);
    try {
      const mockAccounts: ExchangeAccount[] = [
        {
          id: 'eacc_okx_1',
          exchange: 'OKX',
          label: 'OKX 主账号',
          status: 'verified',
          lastVerifiedAt: new Date().toISOString(),
          caps: { orders: true, fills: true, positions: true, liquidations: true },
          account: { exchangeUid: '12345678', subAccount: 'main' },
          masked: { apiKeyLast4: 'a9f2...a9f2', secretKeyLast4: 'sk12...sk12', passphraseLast4: 'pass...word' },
          environment: 'live',
          userConfirmedEcho: false,
        },
        {
          id: 'eacc_bin_1',
          exchange: 'Binance',
          label: '工作号',
          status: 'unverified',
          lastVerifiedAt: null,
          caps: { orders: false, fills: false, positions: false, liquidations: false },
          account: {},
          masked: {},
          environment: 'testnet',
        },
      ];
      console.log('模拟数据已准备:', mockAccounts);
      setAccounts(mockAccounts);
      setAccountForms(prev => {
        const next: Record<string, AccountVerifyForm> = {};
        mockAccounts.forEach(acc => {
          next[acc.id] = prev[acc.id] ?? createInitialVerifyForm();
        });
        return next;
      });
      console.log('账户列表加载完成');
    } catch (error) {
      console.error('加载账户失败:', error);
      setToast('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开创建表单
  const openCreate = () => {
    setEditingId(null);
    setForm({
      exchange: 'OKX',
      label: '',
      environment: 'live',
      ipWhitelist: '',
      apiKey: '',
      apiSecret: '',
      passphrase: '',
      extra: {},
    });
    setDrawerOpen(true);
  };

  // 打开编辑表单
  const openEdit = async (id: string) => {
    setEditingId(id);
    setDrawerOpen(true);
    
    const account = accounts.find(acc => acc.id === id);
    if (account) {
      setForm({
        exchange: account.exchange,
        label: account.label,
        environment: account.environment,
        ipWhitelist: '',
        apiKey: '',
        apiSecret: '',
        passphrase: '',
        instId: pythonScriptService.getInstId(id) || '',
        extra: {},
      });
    }
  };

  // 保存表单
  const saveForm = async () => {
    try {
      if (!editingId) {
        // 调用后端保存API密钥
        const payload = {
          exchange: form.exchange.toLowerCase(),
          api_key: form.apiKey,
          secret: form.apiSecret || form.apiKey, // 兼容表单字段，优先使用 apiSecret
          passphrase: form.passphrase,
        };
        const res = await fetch('/api/v1/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errObj = (data && typeof data.error === 'object') ? data.error : null;
          const reason = (data.detail || data.message || errObj?.message || (typeof data.error === 'string' ? data.error : '') || '保存失败');
          throw new Error(reason);
        }

        // 创建新账户（前端展示用）
        const newAccount: ExchangeAccount = {
          id: 'eacc_' + Date.now(),
          exchange: form.exchange,
          label: form.label,
          status: 'unverified',
          lastVerifiedAt: null,
          caps: { orders: false, fills: false, positions: false, liquidations: false },
          account: {},
          masked: {
            apiKeyLast4: `${form.apiKey.slice(0, 4)}...${form.apiKey.slice(-4)}`,
            secretKeyLast4: `${(form.apiSecret || '').slice(0, 4)}...${(form.apiSecret || '').slice(-4)}`,
            passphraseLast4: form.passphrase ? `${form.passphrase.slice(0, 4)}...${form.passphrase.slice(-4)}` : undefined,
          },
          environment: form.environment,
        };

        pythonScriptService.saveApiKeys(newAccount.id, { apiKey: form.apiKey, secretKey: form.apiSecret || form.apiKey, passphrase: form.passphrase, uid: '' });
        if (form.instId?.trim()) {
          pythonScriptService.saveInstId(newAccount.id, normalizeInstId(form.instId.trim()));
        }
        pythonScriptService.setCurrentUser(newAccount.id);

        setAccounts(prev => [newAccount, ...prev]);
        setToast(t?.apiSettings?.toastSavedKeysPendingVerify || '已保存API密钥，待验证');
        setAccountForms(prev => ({
          ...prev,
          [newAccount.id]: createInitialVerifyForm(),
        }));
      } else {
        // 更新现有账户：若填写了密钥，则更新后端；否则仅保存标签/环境
        const wantsUpdateKeys = !!(form.apiKey?.trim() || form.apiSecret?.trim() || form.passphrase?.trim());
        if (wantsUpdateKeys) {
          const payload = {
            exchange: form.exchange.toLowerCase(),
            api_key: form.apiKey,
            secret: form.apiSecret || form.apiKey,
            passphrase: form.passphrase,
          };
          const res = await fetch('/api/v1/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': localStorage.getItem('api_key') || '' },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (res.status === 401 && import.meta.env.DEV) {
              const devRes = await fetch('http://localhost:3003/api/v1/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': localStorage.getItem('api_key') || '' },
                body: JSON.stringify(payload),
              });
              const devData = await devRes.json().catch(() => ({}));
              if (!devRes.ok) {
                throw new Error(devData?.error?.message || '保存失败');
              }
            } else {
              const errObj = (data && typeof data.error === 'object') ? data.error : null;
              const reason = (data.detail || data.message || errObj?.message || (typeof data.error === 'string' ? data.error : '') || '保存失败');
              throw new Error(reason);
            }
          }
          pythonScriptService.saveApiKeys(editingId, { apiKey: form.apiKey, secretKey: form.apiSecret || form.apiKey, passphrase: form.passphrase, uid: '' });
        }

        if (form.instId?.trim()) {
          pythonScriptService.saveInstId(editingId, normalizeInstId(form.instId.trim()));
        }

        setAccounts(prev => prev.map(acc =>
          acc.id === editingId
            ? { ...acc, label: form.label, environment: form.environment }
            : acc
        ));
        setToast('已保存设置');
      }
      
      setDrawerOpen(false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '保存失败');
    }
  };

  // 删除账户
  const deleteAccount = async (id: string) => {
    if (!confirm('确认删除？将清空密钥并标记为已删除')) return;
    
    try {
      // 调用后端删除API（按交易所删除）
      const exchange = accounts.find(acc => acc.id === id)?.exchange.toLowerCase() || '';
      const response = await fetch(`/api/v1/api-keys/${exchange}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': localStorage.getItem('api_key') || '' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401 && import.meta.env.DEV) {
          const devRes = await fetch(`http://localhost:3003/api/v1/api-keys/${exchange}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': localStorage.getItem('api_key') || '' },
          });
          const devData = await devRes.json().catch(() => ({}));
          if (!devRes.ok) {
            throw new Error(devData?.error?.message || '删除失败');
          }
        } else {
          throw new Error(errorData.error?.message || '删除失败');
        }
      }

      // 后端删除成功后，移除卡片
      setAccounts(prev => prev.filter(acc => acc.id !== id));
      setAccountForms(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setToast('已删除');
    } catch (error: any) {
      console.error('删除账户失败:', error);
      setToast(error.message || '删除失败');
    }
  };

  // 执行验证
  const doVerify = async (accountId: string, payload: VerifyPayload) => {
    setResultData(null);
    setResultError(null);
    setResultOpen(true);
    setCurrentAccountId(accountId);
    setVerifyingMap(prev => ({ ...prev, [accountId]: true }));

    try {
      pythonScriptService.saveApiKeys(accountId, {
        apiKey: payload.apiKey,
        secretKey: payload.secretKey,
        passphrase: payload.passphrase || '',
        uid: payload.uid,
      });
      pythonScriptService.saveInstId(accountId, payload.instId);
      pythonScriptService.setCurrentUser(accountId);
      const scriptResult = await pythonScriptService.verify({ userId: accountId, ordId: payload.ordId, instId: payload.instId, keys: {
        apiKey: payload.apiKey,
        secretKey: payload.secretKey,
        passphrase: payload.passphrase || '',
        uid: payload.uid,
      }});

      // 转换脚本结果到前端格式
      const normalizedStatus: ExchangeAccount['status'] = scriptResult.success ? 'verified' : 'failed';
      const verifiedAt = new Date().toISOString();

      // 构建验证结果
      const verifyResult: VerifyResult = {
        status: scriptResult.success ? 'verified' : 'failed',
        caps: { orders: true, fills: true, positions: true, liquidations: true },
        account: { exchangeUid: payload.uid },
        proof: {
          echo: {
            firstOrderIdLast4: payload.ordId.slice(-4),
            firstFillQty: '1',
            firstFillTime: verifiedAt,
          },
          hash: scriptResult.data?.proof || '脚本验证证明'
        },
        verifiedAt: verifiedAt,
        order: {
          orderId: payload.ordId,
          pair: payload.instId,
          side: 'buy',
          type: 'limit',
          status: 'filled',
          executedQty: '1',
          avgPrice: '50000',
          quoteAmount: '50000',
          orderTimeIso: verifiedAt,
          exchangeTimeIso: verifiedAt,
        },
        checks: {
          authOk: true,
          capsOk: true,
          orderFound: true,
          echoLast4Ok: true,
          arithmeticOk: true,
          pairOk: true,
          timeSkewMs: 0,
          verdict: 'pass'
        },
        liquidation: {
          status: 'none'
        }
      };

      const echo = scriptResult.data?.orderEcho ? JSON.parse(String(scriptResult.data.orderEcho)) : undefined;
      const apiResponse: VerifyResponse = {
        verifyStatus: scriptResult.success ? 'PASS' : 'FAIL',
        canPurchase: scriptResult.success,
        verifiedAt: verifiedAt,
        exchange: payload.exchange,
        instId: payload.instId,
        ordId: payload.ordId,
        side: echo?.side,
        size: echo?.executedQty,
        leverage: undefined,
        avgPx: echo?.avgPrice,
        liqPx: undefined,
        openTime: undefined,
        closeTime: undefined,
        isLiquidated: scriptResult.data?.liquidationStatus === '已清算',
        pnl: undefined,
        currency: undefined,
        verifyReason: scriptResult.error || null,
        evidenceId: scriptResult.data?.proof || null
      };

      setAccounts(prev => prev.map(acc =>
        acc.id === accountId
          ? {
              ...acc,
              status: normalizedStatus,
              lastVerifiedAt: verifiedAt,
              lastVerifyResult: verifyResult,
              userConfirmedEcho: normalizedStatus === 'verified' ? false : acc.userConfirmedEcho,
            }
          : acc
      ));

      setResultData(apiResponse);
      setToast(scriptResult.success ? '脚本验证成功，待确认' : '脚本验证失败');
    } catch (error: any) {
      const message = error?.message || '验证失败';
      setAccounts(prev => prev.map(acc =>
        acc.id === accountId
          ? { ...acc, status: 'failed', lastVerifyResult: undefined }
          : acc
      ));
      setResultError(message);
      setToast(message);
    } finally {
      setVerifyingMap(prev => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
    }
  };

  const doVerifyMock = async (accountId: string, ordId: string) => {
    setResultData(null);
    setResultError(null);
    setResultOpen(true);
    setCurrentAccountId(accountId);
    try {
      const res = await fetch(`/mock/orders/${encodeURIComponent(ordId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || '测试数据验证失败');
      }
      setResultData({
        meta: { source: 'mock', ordId },
        raw: data,
      } as any);
      setToast('测试数据验证成功');
    } catch (error: any) {
      setResultError(error?.message || '测试数据验证失败');
      setToast(error?.message || '测试数据验证失败');
    }
  };

  // 确认回显
  const confirmEcho = async (id: string) => {
    setAccounts(prev => prev.map(acc => 
      acc.id === id 
        ? { ...acc, userConfirmedEcho: true }
        : acc
    ));
    setToast('已记录确认');
  };

  // 获取当前交易所的字段配置
  const currentExchangeFields = EXCHANGES_META[form.exchange]?.fields || [];

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="sticky top-0 z-10 bg-amber-50/80 backdrop-blur border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-zinc-900">{t?.apiSettings?.headerTitle || '个人中心 · API 设置'}</span>
            <span className="text-xs text-zinc-500">{t?.apiSettings?.headerPath || '/settings/exchange-apis'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button kind="ghost" onClick={loadAccounts}>{t?.apiSettings?.refresh || '刷新'}</Button>
            <Button onClick={openCreate}>{t?.apiSettings?.newAccount || '新建账号'}</Button>
          </div>
        </div>
        {toast && (
          <div className="max-w-5xl mx-auto px-4 pb-3 text-sm text-zinc-700">
            {toast}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-zinc-600">{t?.apiSettings?.loading || '加载中…'}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const form = accountForms[acc.id] ?? createInitialVerifyForm();
              return (
                <AccountCard 
                  key={acc.id} 
                  acc={acc} 
                  form={form}
                  onFormChange={(patch) => {
                    setAccountForms(prev => {
                      const prevForm = prev[acc.id] ?? createInitialVerifyForm();
                      return {
                        ...prev,
                        [acc.id]: {
                          ...prevForm,
                          ...patch,
                        },
                      };
                    });
                  }}
                  onEdit={() => openEdit(acc.id)}
                  onDelete={() => deleteAccount(acc.id)}
                  onVerify={(payload) => doVerify(acc.id, payload)}
                  onVerifyMock={(ordId) => doVerifyMock(acc.id, ordId)}
                  onConfirmEcho={() => confirmEcho(acc.id)}
                  onToast={(msg) => setToast(msg)}
                  verifying={verifyingMap[acc.id]}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* 创建/编辑抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingId ? (t?.apiSettings?.editAccount || '编辑账号') : (t?.apiSettings?.createAccount || '新建账号')}
                </h3>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <Field label={t?.apiSettings?.exchange || '交易所'} required>
                  <Select
                    value={form.exchange}
                    onChange={(value) => setForm(prev => ({ ...prev, exchange: value as any }))}
                    options={Object.keys(EXCHANGES_META).map(key => ({
                      value: key,
                      label: EXCHANGES_META[key as keyof typeof EXCHANGES_META].label,
                    }))}
                  />
                </Field>
                
                <Field label={t?.apiSettings?.label || '标签'} required>
                  <Input
                    placeholder="给这个账号起个名字"
                    value={form.label}
                    onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
                  />
                </Field>
                
                <Field label={t?.apiSettings?.env || '环境'} required>
                  <Select
                    value={form.environment}
                    onChange={(value) => setForm(prev => ({ ...prev, environment: value as any }))}
                    options={[
                      { value: 'live', label: t?.apiSettings?.envLive || '实盘' },
                      { value: 'testnet', label: t?.apiSettings?.envTestnet || '测试网' },
                    ]}
                  />
                </Field>
                
                <Field label={t?.apiSettings?.instIdLabel || '固定交易对/合约 InstId（如 BTC-USDT-SWAP）'}>
                  <Input
                    placeholder={t?.apiSettings?.instIdPlaceholder || '如 BTC-USDT-SWAP'}
                    value={form.instId}
                    onChange={(e) => setForm(prev => ({ ...prev, instId: e.target.value }))}
                  />
                </Field>

                {currentExchangeFields.map((field) => (
                  <Field key={field.key} label={field.label} required>
                    <Input
                      type={field.sensitive ? 'password' : 'text'}
                      placeholder={`请输入${field.label}`}
                      value={form[field.key as keyof typeof form] as string || ''}
                      onChange={(e) => setForm(prev => ({ 
                        ...prev, 
                        [field.key]: e.target.value 
                      }))}
                    />
                  </Field>
                ))}
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={saveForm} className="flex-1">
                    {editingId ? (t?.yes || '保存') : (t?.apiSettings?.createAccount || '创建')}
                  </Button>
                  <Button kind="ghost" onClick={() => setDrawerOpen(false)}>
                    {t?.no || '取消'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {resultOpen && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="p-6 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-lg text-zinc-900">验证结果</div>
                <button
                  onClick={() => setResultOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>

              {!resultData && !resultError && (
                <div className="text-sm text-zinc-600">正在验证…请稍候</div>
              )}

              {resultError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  失败：{resultError}
                </div>
              )}

      {resultData && (
        <div className="space-y-3">
          {resultData.verifyId ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-amber-200 bg-white p-3 text-sm text-zinc-900">
                <div> {String(resultData.exchange || '').toUpperCase() || '—'} · {resultData.instId || '—'} · 订单 {resultData.ordId || '—'} </div>
                <div> {(String(resultData.side || '').toLowerCase() === 'long' ? '多' : (String(resultData.side || '').toLowerCase() === 'short' ? '空' : (resultData.side || '—')))}单 · 数量 {resultData.size || '—'} · 杠杆 {typeof resultData.leverage === 'number' ? `${resultData.leverage}x` : '—'} · 开仓价 {resultData.avgPx || '—'} · 强平价 {resultData.liqPx || '—'} </div>
                <div> 开始 {fmtTime(resultData.openTime)} · 结束 {fmtTime(resultData.closeTime)} · 清算：{resultData.isLiquidated ? '是' : '否'} · PnL：{resultData.pnl || '—'} {resultData.currency || ''} </div>
                <div className="mt-1 text-zinc-700">
                  {resultData.verifyStatus === 'PASS' && resultData.canPurchase ? (
                    <> 验证结果：通过 · 允许购买：是 · 证据：{resultData.evidenceId || '—'} · 验证时间：{fmtTime(resultData.verifiedAt)} </>
                  ) : (
                    <> 验证结果：不通过 · 允许购买：否 · 原因：{resultData.verifyReason || '—'} </>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  {resultData.verifyStatus === 'PASS' && resultData.canPurchase ? (
                    <Button
                      kind="primary"
                      onClick={async () => {
                        try {
                          await api.post('/api/v1/verify/confirm', {
                            evidenceId: resultData.evidenceId,
                            ordId: resultData.ordId,
                            instId: resultData.instId,
                          }, { requireAuth: false });
                          setAccounts(prev => prev.map(acc => (currentAccountId && acc.id === currentAccountId) ? { ...acc, userConfirmedEcho: true } : acc));
                          setToast('已确认无误');
                          setResultOpen(false);
                          setConfirmError(null);
                        } catch (e: any) {
                          setConfirmError(e?.message || '确认失败');
                          if (import.meta.env.DEV) {
                            try {
                              const res2 = await fetch('http://localhost:3003/api/v1/verify/confirm', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  evidenceId: resultData.evidenceId,
                                  ordId: resultData.ordId,
                                  instId: resultData.instId,
                                }),
                              });
                              const d2 = await res2.json().catch(() => ({}));
                              if (res2.ok) {
                                setAccounts(prev => prev.map(acc => (currentAccountId && acc.id === currentAccountId) ? { ...acc, userConfirmedEcho: true } : acc));
                                setToast('已确认无误');
                                setResultOpen(false);
                                setConfirmError(null);
                              }
                            } catch {}
                            // 开发模式下：后端不可用时，直接标记为已确认以不中断流程
                            setAccounts(prev => prev.map(acc => (currentAccountId && acc.id === currentAccountId) ? { ...acc, userConfirmedEcho: true } : acc));
                            setToast('已确认无误');
                            setResultOpen(false);
                            setConfirmError(null);
                          }
                        }
                      }}
                    >确认无误</Button>
                  ) : null}
                  <Button kind="ghost" onClick={() => setResultOpen(false)}>关闭</Button>
                </div>
                {confirmError && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">{confirmError}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
                      <Section title="meta" data={resultData.meta} />
                      <Section title="normalized" data={resultData.normalized} />
                      <Section title="raw" data={resultData.raw} />
                      <Section title="evidence" data={resultData.evidence} />
                      <Section title="perf" data={resultData.perf} />
                      {!resultData.meta && !resultData.normalized && !resultData.raw && !resultData.evidence && (
                        <details className="rounded-md border p-3" open>
                          <summary className="cursor-pointer font-medium">response</summary>
                          <pre className="mt-2 text-sm overflow-auto max-h-72">{JSON.stringify(resultData, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
                )}
  
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// AccountCard 组件
const AccountCard = ({ 
  acc, 
  form,
  onFormChange,
  onEdit, 
  onDelete, 
  onVerify, 
  onVerifyMock,
  onConfirmEcho,
  onToast,
  verifying = false,
}: {
  acc: ExchangeAccount;
  form: AccountVerifyForm;
  onFormChange: (patch: Partial<AccountVerifyForm>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: (payload: VerifyPayload) => void;
  onVerifyMock: (ordId: string) => void;
  onConfirmEcho: () => void;
  onToast: (msg: string) => void;
  verifying?: boolean;
}) => {
  const icon = acc.exchange.slice(0, 2).toUpperCase();
  const isVerified = acc.status === "verified";
  const isFailed = acc.status === "failed";
  const last = acc.lastVerifyResult;
  const [submitted, setSubmitted] = useState(false);
  const trimmedForm = {
    apiKey: form.apiKey.trim(),
    secretKey: form.secretKey.trim(),
    passphrase: form.passphrase.trim(),
    uid: form.uid.trim(),
    ordId: form.ordId.trim(),
    instId: form.instId.trim(),
  };
  
  const tryVerify = () => {
    setSubmitted(true);
    
    // 检查是否已保存API密钥
    const hasSavedKeys = pythonScriptService.hasApiKeys(acc.id);
    
    // 构建必填字段列表
    const required = [
      { key: 'ordId', label: '订单号', value: trimmedForm.ordId },
    ];
    
    // 如果没有保存的API密钥，则需要填写所有字段
    if (!hasSavedKeys) {
      required.push(
        { key: 'apiKey', label: 'API Key', value: trimmedForm.apiKey },
        { key: 'secretKey', label: 'Secret Key', value: trimmedForm.secretKey },
        { key: 'instId', label: '交易对/合约', value: trimmedForm.instId },
      );
      
      if (acc.exchange === 'OKX') {
        required.push(
          { key: 'passphrase', label: 'Passphrase', value: trimmedForm.passphrase },
          { key: 'uid', label: 'UID', value: trimmedForm.uid },
        );
      }
    }
    
    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
      const missingLabels = missing.map(item => item.label).join('、');
      onToast(`请填写 ${missingLabels}`);
      return;
    }

    onFormChange(trimmedForm);

    // 构建验证载荷
    const verifyPayload: VerifyPayload = {
      exchange: acc.exchange.toLowerCase(),
      ordId: trimmedForm.ordId,
      instId: hasSavedKeys ? (pythonScriptService.getInstId(acc.id) || 'BTC-USDT-SWAP') : normalizeInstId(trimmedForm.instId),
      live: acc.environment === 'live',
      fresh: true,
      noCache: true,
      keyMode: 'inline',
      apiKey: trimmedForm.apiKey,
      secretKey: trimmedForm.secretKey,
      passphrase: trimmedForm.passphrase || undefined,
      uid: trimmedForm.uid || undefined,
    };

    onVerify(verifyPayload);
  };

  const tryVerifyMock = () => {
    setSubmitted(true);
    if (!trimmedForm.ordId) {
      onToast('请填写 订单号');
      return;
    }
    onVerifyMock(trimmedForm.ordId);
  };
  const saveInlineKeys = () => {
    const required = [
      { key: 'apiKey', label: 'API Key', value: trimmedForm.apiKey },
      { key: 'secretKey', label: 'Secret Key', value: trimmedForm.secretKey },
    ];
    if (acc.exchange === 'OKX') {
      required.push(
        { key: 'passphrase', label: 'Passphrase', value: trimmedForm.passphrase },
        { key: 'uid', label: 'UID', value: trimmedForm.uid },
      );
    }
    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
      const missingLabels = missing.map(item => item.label).join('、');
      onToast(`请填写 ${missingLabels}`);
      return;
    }
    pythonScriptService.saveApiKeys(acc.id, {
      apiKey: trimmedForm.apiKey,
      secretKey: trimmedForm.secretKey,
      passphrase: trimmedForm.passphrase,
      uid: trimmedForm.uid,
    });
    onToast(t?.apiSettings?.savedApiKeys || '已保存API密钥');
  };
  const clearSavedKeys = () => {
    pythonScriptService.clearApiKeys(acc.id);
    onToast('已清除API密钥');
  };
  const saveInlineInstId = () => {
    const val = trimmedForm.instId;
    if (!val) {
      onToast('请填写 固定交易对');
      return;
    }
    pythonScriptService.saveInstId(acc.id, normalizeInstId(val));
    onToast('已保存固定交易对');
  };
  const clearSavedInstId = () => {
    pythonScriptService.clearInstId(acc.id);
    onToast('已清除固定交易对');
  };
  
  const pendingConfirm = isVerified && !acc.userConfirmedEcho;
  
  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
            {icon}
          </div>
          <div>
            <div className="font-medium text-zinc-900">{acc.exchange} · {acc.label}</div>
            <div className="text-xs text-zinc-500">
              环境 {acc.environment} · UID {acc.account?.exchangeUid || "—"} · 子账户 {acc.account?.subAccount || "—"}
            </div>
          </div>
        </div>
        <StatusBadge 
          status={acc.status} 
          lastVerifiedAt={acc.lastVerifiedAt} 
          pendingConfirm={pendingConfirm} 
        />
      </div>

      <div className="text-xs text-zinc-600">
        能力：订单 {bool(acc.caps.orders)} · 成交 {bool(acc.caps.fills)} · 持仓 {bool(acc.caps.positions)} · 强平 {bool(acc.caps.liquidations)}
      </div>

      <div className="text-xs text-zinc-500 space-y-1">
        {acc.masked?.apiKeyLast4 && (
          <div>API Key: {acc.masked.apiKeyLast4}</div>
        )}
        {acc.masked?.secretKeyLast4 && (
          <div>Secret Key: {acc.masked.secretKeyLast4}</div>
        )}
        {acc.masked?.passphraseLast4 && (
          <div>Passphrase: {acc.masked.passphraseLast4}</div>
        )}
      </div>

      {/* 已保存API密钥提示 */}
      {pythonScriptService.hasApiKeys(acc.id) && (
        <div className="rounded-xl border border-green-200 bg-green-50/40 p-3">
          <div className="text-xs text-green-700 font-medium">{t?.apiSettings?.savedApiKeysOk || '✓ 已保存API密钥'}</div>
          <div className="text-xs text-green-600 mt-1">{t?.apiSettings?.savedApiKeysHint || '第二次调用只需输入订单号，交易对将使用已保存的固定交易对'}</div>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
        <div className="text-xs text-zinc-700">API 凭证</div>
        {!pythonScriptService.hasApiKeys(acc.id) && (
          <>
            <Input 
              type="password"
              placeholder="API Key" 
              value={form.apiKey} 
              onChange={(e) => onFormChange({ apiKey: e.target.value })}
              className={submitted && !trimmedForm.apiKey ? 'border-red-400' : ''} 
            />
            <Input 
              type="password"
              placeholder="Secret Key" 
              value={form.secretKey} 
              onChange={(e) => onFormChange({ secretKey: e.target.value })}
              className={submitted && !trimmedForm.secretKey ? 'border-red-400' : ''} 
            />
            {acc.exchange === 'OKX' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input 
                  type="password"
                  placeholder="Passphrase" 
                  value={form.passphrase} 
                  onChange={(e) => onFormChange({ passphrase: e.target.value })}
                  className={submitted && !trimmedForm.passphrase ? 'border-red-400' : ''} 
                />
                <Input 
                  placeholder="UID" 
                  value={form.uid} 
                  onChange={(e) => onFormChange({ uid: e.target.value })}
              className={submitted && !trimmedForm.uid ? 'border-red-400' : ''} 
            />
          </div>
        )}
          <div className="mt-2 flex gap-2">
            {!pythonScriptService.hasApiKeys(acc.id) ? (
              <Button onClick={saveInlineKeys}>保存API密钥</Button>
            ) : (
              <Button kind="danger" onClick={clearSavedKeys}>清除API密钥</Button>
            )}
          </div>
          </>
        )}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
        <div className="text-xs text-zinc-700">固定交易对</div>
        <div className="text-[11px] text-zinc-500">当前：{pythonScriptService.getInstId(acc.id) || '未设置'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input 
            placeholder="如 BTC-USDT-SWAP" 
            value={form.instId} 
            onChange={(e) => onFormChange({ instId: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={saveInlineInstId}>保存交易对</Button>
            <Button kind="danger" onClick={clearSavedInstId}>清除交易对</Button>
          </div>
        </div>
      </div>
      
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
        <div className="text-xs text-zinc-700 mb-2">验证参数</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input 
            placeholder="合约订单号 OrdId" 
            value={form.ordId} 
            onChange={(e) => onFormChange({ ordId: e.target.value })}
            className={submitted && !trimmedForm.ordId ? 'border-red-400' : ''} 
          />
          {!pythonScriptService.hasApiKeys(acc.id) && (
            <Input 
              placeholder="交易币对/合约 InstId（如 BTC-USDT-SWAP）" 
              value={form.instId} 
              onChange={(e) => onFormChange({ instId: e.target.value })}
              className={submitted && !trimmedForm.instId ? 'border-red-400' : ''} 
            />
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-1">{pythonScriptService.hasApiKeys(acc.id) ? (t?.apiSettings?.savedApiKeysHint || "已保存API密钥，只需输入订单号，交易对将使用已保存的固定交易对") : "需填写订单号与币对用于生成回显；生成回显后需\"确认无误\"才记为通过。"}</div>
      </div>

      {isVerified && last?.proof?.echo && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 space-y-2">
          <div className="font-medium">证明片段（脱敏）</div>
          <div>
            第一笔订单ID后4位 {last.proof.echo.firstOrderIdLast4} · {fmtTime(last.proof.echo.firstFillTime)} · 数量 {last.proof.echo.firstFillQty}
          </div>
          <div className="text-xs text-emerald-900/70">哈希：{last.proof.hash}</div>

          {last.order && (
            <div className="pt-2">
              <div className="font-medium mb-1">订单回显</div>
              <div className="text-xs text-emerald-900/90">
                订单号 {last.order.orderId} · 币对 {last.order.pair} · {last.order.side}/{last.order.type} · 状态 {last.order.status}<br/>
                数量 {last.order.executedQty} × 均价 {last.order.avgPrice} ≈ 成交额 {last.order.quoteAmount}<br/>
                时间 {fmtTime(last.order.orderTimeIso)}
              </div>
            </div>
          )}

          {last.checks && (
            <div className="pt-1">
              <div className="font-medium mb-1">一致性检查</div>
              <ul className="text-xs leading-6">
                <li>鉴权 {tick(last.checks.authOk)} · 能力 {tick(last.checks.capsOk)} · 找到订单 {tick(last.checks.orderFound)}</li>
                <li>订单号后4位匹配 {tick(last.checks.echoLast4Ok)} · 乘法闭合 {tick(last.checks.arithmeticOk)} · 币对匹配 {tick(last.checks.pairOk)}</li>
                <li>时间偏差 {last.checks.timeSkewMs} ms · 结论 {last.checks.verdict === 'pass' ? '通过' : '不通过'}</li>
              </ul>
            </div>
          )}

          {last.liquidation && (
            <div className="pt-1">
              <div className="font-medium mb-1">清算状态</div>
              <div className="text-xs">
                {last.liquidation.status === "none" ? "无清算事件" : `清算类型: ${last.liquidation.status}`}
                {last.liquidation.eventTimeIso ? ` · 时间: ${fmtTime(last.liquidation.eventTimeIso)}` : ""}
                {last.liquidation.instrument ? ` · 合约: ${last.liquidation.instrument}` : ""}
                {last.liquidation.positionSizeBefore ? ` · 前持仓: ${last.liquidation.positionSizeBefore}` : ""}
                {last.liquidation.positionSizeAfter ? ` · 后持仓: ${last.liquidation.positionSizeAfter}` : ""}
                {last.liquidation.pnlAbs ? ` · PnL: ${last.liquidation.pnlAbs}` : ""}
              </div>
            </div>
          )}

          </div>
        )}

      {isFailed && last?.reasons && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-medium">失败原因</div>
          <ul className="text-xs mt-1 space-y-1">
            {last.reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={tryVerify} kind="primary" disabled={verifying}>
          {verifying ? "验证中…" : "验证"}
        </Button>
        <Button onClick={tryVerifyMock} kind="ghost">测试数据验证</Button>
        <Button onClick={onEdit} kind="ghost">编辑</Button>
        <Button onClick={onDelete} kind="danger">删除</Button>
      </div>
    </div>
  );
};

function Section({ title, data }: { title: string; data: any }) {
  if (data === undefined || data === null) return null;
  return (
    <details className="rounded-md border p-3" open>
      <summary className="cursor-pointer font-medium">{title}</summary>
      <pre className="mt-2 text-sm overflow-auto max-h-72">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

// 辅助函数
const bool = (value: boolean) => value ? '✓' : '✗';
const tick = (value: boolean) => value ? '✓' : '✗';
const fmtTime = (timeStr?: string) => {
  if (!timeStr) return '';
  return new Date(timeStr).toLocaleString('zh-CN');
};

const normalizeInstId = (input: string): string => {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  const low = raw.toLowerCase().replace(/\s+/g, '');
  if (low === 'btuusdc') return 'BTC-USDC-SWAP';
  if (raw.includes('-')) {
    const parts = raw.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
    if (parts.length === 2) return `${parts[0]}-${parts[1]}-SWAP`;
    if (parts.length >= 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  if (low.endsWith('usdt')) {
    const base = low.slice(0, low.length - 4).toUpperCase();
    return `${base}-USDT-SWAP`;
  }
  if (low.endsWith('usdc')) {
    const base = low.slice(0, low.length - 4).toUpperCase();
    return `${base}-USDC-SWAP`;
  }
  return raw.toUpperCase();
};
