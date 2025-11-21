import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Landing } from './pages/Landing';
import { CreateLink } from './pages/CreateLink';
import { Links } from './pages/Links';
import { Payment } from './pages/Payment';
import { Success } from './pages/Success';
import { ProfilePage } from './pages/ProfilePage';
import { ApiSettings } from './pages/ApiSettings';
import { OrdersPage } from './pages/OrdersPage';
import { ProductDemo } from './pages/ProductDemo';
import { Products } from './pages/Products';
import TransparencyPage from './pages/TransparencyPage';
import { Help } from './pages/Help';
import ClaimsManage from './pages/ClaimsManage';
import { ClaimsPage } from './pages/ClaimsPage';
import OrderDetailPage from './pages/OrderDetailPage';
import { zh } from './i18n/zh';
import { en } from './i18n/en';
import ClaimDetailPage from './pages/ClaimDetailPage';

function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = lang === 'zh' ? zh : en;

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <WalletProvider>
        <ToastProvider>
          <ErrorBoundary>
            <div className="min-h-screen bg-[#FFF7ED] flex flex-col">
              <Header lang={lang} setLang={setLang} t={t} />
              
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/links" element={<Links />} />
                  <Route path="/links/create" element={<CreateLink />} />
                  <Route path="/pay/:id" element={<Payment />} />
                  <Route path="/success" element={<Success />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings/api" element={<ApiSettings />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/account/orders" element={<Navigate to="/orders" replace />} />
                  <Route path="/claims" element={<ClaimsManage />} />
                  <Route path="/claims/new" element={<ClaimsPage />} />
                  <Route path="/claims/:claimId" element={<ClaimDetailPage />} />
                  <Route path="/account/claims" element={<Navigate to="/claims" replace />} />
                  <Route path="/account/claims/new" element={<Navigate to="/claims/new" replace />} />
                  <Route path="/product/demo" element={<ProductDemo />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/transparency" element={<TransparencyPage />} />
                  <Route path="/help" element={<Help />} />
                  <Route path="/help/en" element={<Help />} />
                  <Route path="/help/10" element={<Help />} />
                </Routes>
              </main>
              
              <Footer />
            </div>
          </ErrorBoundary>
        </ToastProvider>
      </WalletProvider>
    </Router>
  );
}

export default App;
