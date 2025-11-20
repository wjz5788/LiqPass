# API设置页面功能增强

## 概述

本文档记录了对API设置页面的功能增强，主要包括固定交易对支持、API密钥本地保存功能优化等改进。

## 修改内容

### 1. 固定交易对支持

- **功能描述**：新增`instId`字段，允许用户设置固定的交易对/合约ID
- **实现方式**：
  - 在表单中添加交易对输入字段
  - 新增`normalizeInstId`函数自动规范化交易对格式
  - 支持交易对的保存和清除操作

### 2. API密钥本地保存优化

- **功能描述**：优化API密钥的本地保存与管理机制
- **实现方式**：
  - 通过`pythonScriptService`实现密钥的保存、获取和清除
  - 提供直观的保存/清除按钮
  - 显示密钥保存状态提示

### 3. 用户体验优化

- **功能描述**：提升用户使用体验，减少重复操作
- **实现方式**：
  - 已保存密钥后，验证时只需输入订单号
  - 交易对自动使用已保存的固定值
  - 清晰的状态提示和操作反馈

### 4. 多语言支持增强

- **功能描述**：添加相关文本的翻译占位符
- **实现方式**：
  - 使用`t?.apiSettings?.xxx`格式引用翻译文本
  - 为各种状态提示和标签添加国际化支持

## 关键函数

### normalizeInstId

```typescript
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
```

**功能说明**：自动规范化交易对格式，支持多种输入形式：
- 自动识别并规范化BTCUSDT、BTC-USDT、BTC-USDT-SWAP等格式
- 针对USDT和USDC后缀的特殊处理
- 统一输出为标准的三段式格式（如BTC-USDT-SWAP）

## 修改文件

- `apps/us-frontend/src/pages/ApiSettings.tsx`

## 技术细节

### 数据流向

1. 用户输入API密钥和交易对信息
2. 点击保存按钮，通过`pythonScriptService`保存到本地
3. 验证时，优先使用已保存的密钥和交易对
4. 规范化的交易对格式确保与交易所API的兼容性

### 状态管理

- 使用React状态管理表单数据和验证状态
- 通过`pythonScriptService`管理持久化的API密钥和交易对信息
- 提供清晰的用户界面反馈，显示当前保存状态

## 后续优化方向

1. 添加更多交易对格式的自动识别和规范化
2. 增强错误处理和验证机制
3. 考虑添加API密钥的加密存储
4. 优化多交易所的兼容性支持