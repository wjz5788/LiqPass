import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DocCN from './help/DocCN';
import DocEN from './help/DocEN';
import Doc10 from './help/Doc10';

export const Help: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const current = path.endsWith('/en') ? 'EN' : path.endsWith('/10') ? 'DOC10' : 'CN';
  return (
    <div className="min-h-screen bg-[#FFF7ED] text-[#3F2E20]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">帮助 / Help</h1>
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 md:col-span-3">
            <div className="rounded-2xl border bg-white/70 p-4 shadow-sm space-y-2">
              <button
                onClick={() => navigate('/help')}
                className={`w-full text-left px-3 py-2 rounded-lg border ${current === 'CN' ? 'bg-[#3F2E20] text-white' : 'bg-white/70 text-[#3F2E20]'}`}
              >中文文档（最终版）</button>
              <button
                onClick={() => navigate('/help/en')}
                className={`w-full text-left px-3 py-2 rounded-lg border ${current === 'EN' ? 'bg-[#3F2E20] text-white' : 'bg-white/70 text-[#3F2E20]'}`}
              >English Document</button>
              <button
                onClick={() => navigate('/help/10')}
                className={`w-full text-left px-3 py-2 rounded-lg border ${current === 'DOC10' ? 'bg-[#3F2E20] text-white' : 'bg-white/70 text-[#3F2E20]'}`}
              >10 页面说明</button>
            </div>
          </aside>
          <section className="col-span-12 md:col-span-9">
            {current === 'CN' && <DocCN />}
            {current === 'EN' && <DocEN />}
            {current === 'DOC10' && <Doc10 />}
          </section>
        </div>
      </div>
    </div>
  );
};