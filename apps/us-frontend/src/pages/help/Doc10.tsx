import React from 'react'

const CONTENT = `1. 你在做什么 / What You Are Building

做“合约杠杆交易的保险”：LiqPass（爆仓保）。
You are building LiqPass, a liquidation insurance product for leveraged derivatives traders.

产品形态：参数化短期保险（8h / 24h / 月度）。
Product form: Parametric short-term insurance (8h / 24h / monthly).

触发与赔付：强平 → 用户提交爆仓订单号 → 系统被动判定 → 按规则赔付。
Trigger & payout: Forced liquidation → user submits the liquidated order ID → system passively verifies → payout according to preset rules.

可信交付：只认链上入账事件与交易所只读数据；证据 → 摘要 → 锚定，可复核。
Trust model: Only on-chain premium receipts and CEX read-only data are trusted; evidence → summary → on-chain anchor, all verifiable and auditable.

首发范围：BTC/USDC、BTC/USDT 的高杠杆场景（≥20×），先做深做透再扩品。
Initial scope: High-leverage BTC/USDC and BTC/USDT perpetuals (≥20×). Go deep on this wedge first, then expand to more products.

2. 解决了什么问题 / What Problem It Solves

新增人群：给“怕爆仓”的散户一个预算内亏损上限 → 敢进场、敢持仓。
New user segment: Gives risk-averse retail traders a budgeted loss cap, so they dare to enter and hold positions.

手续费提升：更高下单频率与持仓时长 → 平台交易量与交易费增加。
Higher fees for venues: More frequent trading and longer holding periods → higher volume and fee revenue for exchanges.

散户收益更稳：尾部亏损换成小而确定的保费，资金曲线更平滑（非保本）。
Smoother PnL for users: Converts tail losses into a small, fixed premium, making the equity curve smoother (not principal-guaranteed).

新赛道：为平台/量化/社区提供“衍生品 × 保障”的白标与 SDK，打开保费分成。
New revenue lane: White-label and SDK for exchanges, quant funds, and communities to bundle "derivatives × protection" and share insurance premiums.

信任可验证：一切以事件与证据链为准，减少扯皮与风控灰度。
Verifiable trust: Everything is driven by objective events and evidence chains, reducing disputes and opaque risk decisions.

3. 商业模式 / 如何赚钱

3. Business Model / How You Make Money

C 端保费：核心收入。
Retail premiums: Core revenue stream.

交易手续费返佣：与 CEX / DEX 合作获得返佣，提高每单有效毛利；让利一定比例给用户。
Trading fee rebates: Partner with CEX/DEX to receive rebates, lifting gross margin per policy; share part of it back with users.

营销费用：渠道佣金/获客成本（CAC）。
Marketing flows: Channel commissions and customer acquisition cost (CAC) economics.

单位经济学目标：赔付率 60–70%，毛利 20–30%；通过限额、等待期、黑名单与敞口控制稳定波动。
Unit economics target: 60–70% loss ratio, 20–30% gross margin, stabilized via coverage caps, waiting periods, blacklists, and exposure limits.

数据背书（BTC 100× 杠杆）：
Data backing (BTC 100× leverage backtest):

样本期 282 天；爆仓日 139 天；爆仓概率 49.29%。
Sample period: 282 days; liquidation days: 139; liquidation probability 49.29%.
3s/5s 窗口爆仓概率一致（49.29%），规则稳健。
3s/5s sampling windows produce the same liquidation probability (49.29%), indicating stable rules.
爆仓日均变动 -0.91%；非爆仓日 +1.06%；最大单日跌幅 -9.74%。
On liquidation days, average move -0.91%; on non-liquidation days, +1.06%; worst single-day drawdown -9.74%.
100× 赔付上限：按定价公式，赔付比例封顶 50% 本金。
100× payout cap: Pricing formula caps payout at 50% of notional principal.
先验换算：p_24h = 49.29%；p_8h ≈ 20.3%（由日先验折算）。
Prior probabilities: p_24h = 49.29%, p_8h ≈ 20.3% (derived from daily prior).

用途：
How the data is used:

依据 -9.74% 配置单日赔付封顶与敞口限额（日 NEP / 赔付上限）。
Use the -9.74% drawdown to set daily payout caps and exposure limits (daily NEP / max payout).
当日跌幅进入“冲击分位”（如 < -1%）时，load 自动上调一档。
When daily drawdown hits "shock quantiles" (e.g. < -1%), the pricing load factor automatically increases.

行为校准：
Behavioral calibration:

散户盯仓/减仓等微观行为降低实际爆仓概率；
Micro behaviors like monitoring and de-leveraging tend to reduce realized liquidation probability.
但“只在陡跌时购买”的逆选择抬高条件概率；
However, adverse selection (buying only on sharp drops) raises conditional liquidation probability.
做法：在先验上引入行为修正系数 β（0.8–1.0），结合实盘与证据包逐步收敛，宁保守、后下调。
Approach: introduce a behavioral adjustment factor β (0.8–1.0) on top of the prior, then update with live data and evidence bundles—start conservative, adjust downward over time.

4. 为什么是你来做 / Why You

正在开发：CheckoutUSDC 已上线 Base（0xc4d1…9709），前端/后端/验证链路已跑通，可演示。
Already building: CheckoutUSDC is deployed on Base (0xc4d1…9709), and the front-end, back-end, and verification pipeline are wired up and demo-ready.

执行力与跨栈能力：前端/后端/合约/验证由同一人统筹，需求→上线闭环可控，迭代快、成本低。
Execution & full-stack ownership: One person orchestrates front-end, back-end, contracts, and verification, keeping the loop from spec → shipping tight, fast, and cost-efficient.

资源与沉淀：主网合约、事件监听、证据与风控曲线等资产已落地，可复用、可复制，形成进入门槛。
Assets already in place: Mainnet contracts, event listeners, evidence formats, and risk curves are already implemented—reusable, repeatable, and defensible.

商业模型清晰：C 端保费 + 手续费返佣 + 渠道分成（20–40%，T+7），单位经济可推演。
Clear business model: Retail premiums + trading fee rebates + channel rev-share (20–40%, T+7). Unit economics can be modeled, not hand-waved.

三方共赢：用户获得新的赚钱机会；平台赚手续费；我们赚保费与返佣，并以限额/等待期/黑名单/敞口管理实现可持续毛利。
Three-way win: Users gain a new way to shape risk/return; venues earn more fees; you earn premiums and rebates while maintaining sustainable margins via caps, waiting periods, blacklists, and exposure controls.

寻求合作：为加速落地，寻找交易所/渠道/量化/审计等伙伴共同推进。
Looking for partners: Actively seeking exchanges, channels, quant teams, and auditors to accelerate go-to-market together.

5. 目前处于什么阶段 / Current Stage

仓库：https://github.com/wjz5788/LiqPass
Repository: https://github.com/wjz5788/LiqPass

前端：主流程完成 ~80%，钱包/下单/状态已串。
Front-end: Core flow ~80% complete; wallet, purchase, and order state are connected.

合约：CheckoutUSDC 已上 Base 主网（0xc4d1…9709），基于 PremiumPaid 事件；浏览器验证收尾中。
Contracts: CheckoutUSDC is live on Base mainnet (0xc4d1…9709), keyed on the PremiumPaid event; block explorer verification is being finalized.

后端（TS+Express+SQLite）：从“传回执即已付”切到事件驱动（监听链上入账 → 回填订单），补偿任务与限额策略落地。
Backend (TS + Express + SQLite): Migrated from "TX receipt = paid" to an event-driven model (listen to on-chain receipts → update orders). Compensation jobs and limit strategies are being implemented.

验证服务（Python+FastAPI）：OKX/币安只读 + HMAC 校验就绪，输出 evidence_bundle 与 merkleRoot，每日上链锚定在对接。
Verification service (Python + FastAPI): OKX/Binance read-only integration with HMAC verification is ready, producing evidence_bundle and merkleRoot. Daily on-chain anchoring is being wired up.

下一里程碑（近期）：打通“买保 → PremiumPaid → 订单回填 → 证据归档/上链 → 透明页 → 触发赔付”的小规模内测闭环，并上线 B 端分成仪表盘（GMV/赔付率/分成额）。
Next milestone (near term): Close the internal test loop of "buy policy → PremiumPaid → order backfill → evidence archiving/on-chain anchor → transparency page → payout trigger", and launch a B-side rev-share dashboard (GMV / loss ratio / revenue share).`;

export default function Doc10() {
  return (
    <article className="mx-auto max-w-4xl rounded-2xl border bg-white/80 p-6 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">10 页面说明</h2>
      <div className="text-stone-800 leading-8 tracking-wide whitespace-pre-wrap">
        {CONTENT}
      </div>
    </article>
  )
}