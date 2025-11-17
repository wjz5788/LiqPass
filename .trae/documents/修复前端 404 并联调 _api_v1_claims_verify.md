## 改造目标
- 在赔付管理页面点击“验证”时：先调用 `POST /api/v1/claims/prepare` 取回 `claimId`，再调用 `POST /api/v1/claims/verify`，使用 `{ claimId, orderRef }` 完成验证并渲染证据。

## 具体改动
- 文件：`apps/us-frontend/src/pages/ClaimsManage.tsx`
- 替换现有 `handleVerify`（当前位于 `ClaimsManage.tsx:103-138`）为：
```tsx
const handleVerify = async () => {
  if (!expandedOrderId || !orderRefInput.trim()) return;
  setLoading(true);
  setError(null);
  try {
    const prepareResp = await authFetchJson<any>("/api/v1/claims/prepare", {
      method: "POST",
      body: JSON.stringify({ orderId: expandedOrderId }),
    });
    const claimId = String(prepareResp?.claimId || "").trim();
    if (!claimId) throw new Error("后端未返回 claimId");

    const data = await authFetchJson<any>("/api/v1/claims/verify", {
      method: "POST",
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
```
- 其余页面结构、`authFetchJson` 的导入路径（`../lib/authFetch`）保持不变。

## 后端与联调建议
- 本地联调启用轻量演示模式：设置 `JP_VERIFY_TEST_MODE=1`，`/claims/verify` 将返回固定演示证据便于前端验证。
- 健康检查：`GET /api/v1/health/ready`（本地后端与前端代理目标皆可）。

## 验证步骤
- 启动前端与后端；在页面展开某订单，输入有效的 `orderRef`。
- 点击“验证”应成功渲染证据卡片，订单状态由 `PENDING` 切换为 `VERIFIED`（后端返回为待放款态）。

请确认以上改动计划，我将据此直接在仓库中更新代码并进行本地验证。