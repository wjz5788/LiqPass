/**
 * @file router.ts
 * @description 前端路由配置和类型定义
 * @author LiqPass Team
 * @notice 定义应用路由结构、页面描述符和路径处理工具函数
 */

import type { SupportedLanguage } from './utils/language';  // 支持的语言类型

/**
 * 本地化文本类型，支持多种语言
 */
export type LocalizedText = Record<SupportedLanguage, string>;

/**
 * 锚点定义接口，用于页面内导航
 */
export interface AnchorDefinition {
  id: string;              // 锚点唯一标识
  label: LocalizedText;    // 锚点显示文本
}

/**
 * 页面描述符接口，定义页面的基本属性
 */
export interface PageDescriptor {
  id: string;                      // 页面唯一标识
  label: LocalizedText;            // 页面显示名称
  component?: React.ComponentType; // 页面组件
  init?: () => void;               // 页面初始化函数
  anchors?: AnchorDefinition[];   // 页面内锚点列表
}

/**
 * 路由属性接口，用于创建路由
 */
export interface RouteProps {
  path: string;            // 路由路径
  element: PageDescriptor; // 页面描述符
}

/**
 * 路由定义接口，扩展页面描述符并包含路径信息
 */
export interface RouteDefinition extends PageDescriptor {
  path: string;                      // 路由路径
  component?: React.ComponentType;   // 页面组件
}

/**
 * 确保路径以斜杠开头
 * @param path - 原始路径
 * @returns 以斜杠开头的路径
 */
function ensureLeadingSlash(path: string): string {
  if (!path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * 标准化路径，确保格式一致
 * @param path - 原始路径
 * @returns 标准化后的路径
 */
export function normalizePath(path: string): string {
  const normalized = ensureLeadingSlash(path.trim());        // 确保开头有斜杠
  const withoutTrailing = normalized.replace(/\/+$/, '');   // 移除末尾斜杠
  return withoutTrailing || '/';                            // 空路径返回根路径
}

/**
 * 创建路由定义的工厂函数
 * @param props - 路由属性
 * @returns 标准化的路由定义
 */
export function Route(props: RouteProps): RouteDefinition {
  // 深拷贝锚点数组
  const anchors = props.element.anchors?.map((anchor) => ({ ...anchor })) ?? undefined;
  
  return {
    path: normalizePath(props.path),           // 标准化路径
    id: props.element.id,                      // 页面ID
    label: { ...props.element.label },         // 深拷贝标签
    component: props.element.component,        // 页面组件
    init: props.element.init,                   // 初始化函数
    anchors,                                   // 锚点数组
  };
}
