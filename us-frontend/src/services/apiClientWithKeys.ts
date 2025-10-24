import { apiRequest, JP_API_BASE, US_API_BASE, ApiRequestOptions } from './apiClient';
import { useApiKeys } from '../contexts/ApiKeyContext';

/**
 * Extended API request options interface - supports API key configuration
 */
export interface ApiRequestWithKeysOptions extends ApiRequestOptions {
  includeApiKeys?: boolean; // Whether to include API keys
  exchange?: 'binance' | 'okx'; // Exchange type
}

/**
 * API request function with API key support
 * @param path - API path
 * @param options - Request options (including API key configuration)
 * @returns API response data
 */
export async function apiRequestWithKeys<T = unknown>(
  path: string,
  options: ApiRequestWithKeysOptions = {}
): Promise<T> {
  const { includeApiKeys = false, exchange, ...restOptions } = options;
  
  // Add API keys to headers if needed
  if (includeApiKeys && exchange) {
    // Use the headers passed by the caller, which already contain API key information
    const headers = restOptions.headers || {};
    
    // No need for additional API key processing here, as the verification service 
    // has already added API keys to the request headers
    // We just need to ensure these header information is correctly passed to the backend API
    
    return apiRequest<T>(path, {
      ...restOptions,
      headers,
    });
  }
  
  // If API keys are not needed, use the original apiRequest function
  return apiRequest<T>(path, restOptions);
}

/**
 * 日本验证API专用请求函数
 * @param path - API路径
 * @param options - 请求选项
 * @returns API响应数据
 */
export async function jpApiRequestWithKeys<T = unknown>(
  path: string,
  options: ApiRequestWithKeysOptions = {}
): Promise<T> {
  // JP API的路径处理
  const fullPath = path.startsWith('http') ? path : `${JP_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  
  return apiRequestWithKeys<T>(fullPath, {
    ...options,
    includeApiKeys: options.includeApiKeys ?? true, // 默认包含API密钥
  });
}