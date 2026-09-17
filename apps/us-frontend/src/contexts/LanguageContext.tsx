import React, { createContext, useContext, useMemo, useState } from 'react';
import { zh } from '../i18n/zh';
import { en } from '../i18n/en';

export type Lang = 'zh' | 'en';
export type Dict = typeof zh;

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
}

/**
 * 修复：App.tsx 里算出了 `const t = lang === 'zh' ? zh : en`，但只传给了 Header。
 * Landing.tsx / CreateLink.tsx 直接引用 `t`（TS2304: Cannot find name 't'），
 * Links.tsx 声明了 `t: Dictionary` 这个 prop 却从来没人传。
 * 统一改为通过 Context 下发。
 */
const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('zh');
  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: (lang === 'zh' ? zh : en) as Dict }),
    [lang]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage 必须在 LanguageProvider 内部使用');
  return ctx;
}

export default LanguageContext;
