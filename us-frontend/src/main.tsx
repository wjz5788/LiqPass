/**
 * @file main.tsx
 * @description React应用入口文件
 * @author LiqPass Team
 * @notice 负责初始化React应用并挂载到DOM
 */

import React from 'react';                    // React核心库
import { createRoot } from 'react-dom/client'; // React 18的createRoot API
import App from './App';                      // 主应用组件
import './styles/main.css';                   // 全局样式文件

// 等待DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  // 获取根DOM元素
  const container = document.getElementById('root');
  
  if (container) {
    // 创建React根节点并渲染应用
    const root = createRoot(container);
    root.render(<App />);
  } else {
    // 如果找不到根元素，输出错误信息
    console.error('Failed to find the root element');
  }
});