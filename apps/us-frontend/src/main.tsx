import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import installAuthFetch from './lib/authFetch'

// 安装全局 Authorization 拦截器（未登录阻断 + 统一注入）
installAuthFetch()

// 可选：通过 ?force01 开启 0.01 USDC 强制支付调试拦截
try {
  const qs = new URLSearchParams(location.search);
  // 修复：原实现只看 ?force01，生产环境同样生效 —— 任何人给线上地址加上
  // ?force01 就能劫持 window.fetch，把保费改写成 0.01 USDC 并本地伪造凭证。
  // 现在仅在开发构建中允许启用。
  if (qs.has('force01') && import.meta.env.DEV) {
    await import('./debug/fetchForcePremium');
    console.warn('[debug] fetchForcePremium enabled: premium forced to 0.01 USDC');
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
