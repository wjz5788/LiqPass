import React, { useState } from "react";
import { useWallet } from "../contexts/WalletContext";
import { EnhancedBuyButton } from "../components/Permit2BuyButton";
 
type Locale = "zh-CN" | "en-US"; 
type Localized = { zh: string; en?: string } | string; 

function makeLocalizedMessage(zh: string, en?: string): Localized { 
  return { zh, en: en ?? zh }; 
}

function getLocalized(msg: Localized, locale: Locale) { 
  if (typeof msg === "string") return msg; 
  return locale === "en-US" ? msg.en ?? msg.zh : msg.zh; 
}

const UX_PRODUCTS = [ 
  { 
    id: "OKX-DAY-100", 
    name: makeLocalizedMessage("当日爆仓保 · 定额赔付 100 USDT", "Same-day liquidation cover · Flat payout 100 USDT"), 
    premium: makeLocalizedMessage("10 USDC", "10 USDC"), 
    leverageCap: makeLocalizedMessage("≤ 20x", "≤ 20x"), 
    payoutCap: makeLocalizedMessage("100 USDT", "100 USDT"), 
    waitPeriod: makeLocalizedMessage("30 分钟等待期", "30-minute waiting period"), 
  },
  { 
    id: "BINANCE-DAY-500", 
    name: makeLocalizedMessage("当日爆仓保 · 定额赔付 500 USDT", "Same-day liquidation cover · Flat payout 500 USDT"), 
    premium: makeLocalizedMessage("50 USDC", "50 USDC"), 
    leverageCap: makeLocalizedMessage("≤ 15x", "≤ 15x"), 
    payoutCap: makeLocalizedMessage("500 USDT", "500 USDT"), 
    waitPeriod: makeLocalizedMessage("30 分钟等待期", "30-minute waiting period"), 
  },
  { 
    id: "BYBIT-DAY-200", 
    name: makeLocalizedMessage("当日爆仓保 · 定额赔付 200 USDT", "Same-day liquidation cover · Flat payout 200 USDT"), 
    premium: makeLocalizedMessage("20 USDC", "20 USDC"), 
    leverageCap: makeLocalizedMessage("≤ 25x", "≤ 25x"), 
    payoutCap: makeLocalizedMessage("200 USDT", "200 USDT"), 
    waitPeriod: makeLocalizedMessage("30 分钟等待期", "30-minute waiting period"), 
  },
]; 

export function ProductsPage() { 
  const [selectedProductId, setSelectedProductId] = useState<string>(UX_PRODUCTS[0]?.id ?? ""); 
  const [locale] = useState<Locale>("zh-CN");
  const { isConnected, address } = useWallet();

  const L = (m: Localized) => getLocalized(m, locale); 

  const handleSelect = (id: string) => { 
    setSelectedProductId(id); 
  };

  const handleBuyNow = () => {
    if (!selectedProductId) {
      alert(L(makeLocalizedMessage("请选择一个产品", "Please select a product")));
      return;
    }
    
    if (!isConnected) {
      alert(L(makeLocalizedMessage("请先连接钱包", "Please connect your wallet first")));
      return;
    }
    
    // Navigate to verify page with selected product
    window.location.href = `/verify?product=${selectedProductId}`;
  };

  return ( 
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {L({ zh: "保险产品", en: "Insurance Products" })}
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            {L({ zh: "为您的杠杆交易头寸提供链上清算保险保护。选择我们为各大交易所精心设计的保险产品。", 
                 en: "Protect your leveraged trading positions with our on-chain liquidation insurance. Choose from our curated selection of insurance products designed for major exchanges." })}
          </p>
        </div>

        {/* Products Section */}
        <section className="space-y-8"> 
          <h2 className="text-2xl font-semibold text-white"> 
            {L({ zh: "合约保险产品列表", en: "Insurance product catalog" })} 
          </h2> 

          <div className="grid gap-6 md:grid-cols-3"> 
            {UX_PRODUCTS.map((product) => { 
              const active = product.id === selectedProductId; 
              return ( 
                <button 
                  type="button" 
                  key={product.id} 
                  onClick={() => handleSelect(product.id)} 
                  className={`rounded-2xl border p-6 text-left transition-all duration-300 ${
                    active 
                      ? "border-indigo-400 bg-indigo-400/10 shadow-lg shadow-indigo-500/20 transform scale-105" 
                      : "border-white/10 bg-white/5 hover:border-indigo-400/60 hover:bg-white/10" 
                  }`} 
                > 
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest"> 
                    <span className="text-indigo-200/80">{product.id}</span> 
                    {active && ( 
                      <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-indigo-100"> 
                        {L({ zh: "当前", en: "Selected" })} 
                      </span> 
                    )} 
                  </div> 

                  <h3 className="mt-3 text-lg font-semibold text-white"> 
                    {L(product.name)} 
                  </h3> 

                  <ul className="mt-4 space-y-2 text-sm text-slate-200/80"> 
                    <li className="flex justify-between"> 
                      <span>{L({ zh: "保费：", en: "Premium: " })}</span>
                      <span className="text-emerald-400 font-semibold">{L(product.premium)}</span>
                    </li> 
                    <li className="flex justify-between"> 
                      <span>{L({ zh: "杠杆上限：", en: "Leverage cap: " })}</span>
                      <span>{L(product.leverageCap)}</span>
                    </li> 
                    <li className="flex justify-between"> 
                      <span>{L({ zh: "赔付额上限：", en: "Payout cap: " })}</span>
                      <span className="text-emerald-400 font-semibold">{L(product.payoutCap)}</span>
                    </li> 
                    <li className="flex justify-between"> 
                      <span>{L({ zh: "等待期：", en: "Waiting period: " })}</span>
                      <span>{L(product.waitPeriod)}</span>
                    </li> 
                  </ul> 
                </button> 
              ); 
            })} 
          </div>

          {/* Buy Now Button */}
          <div className="text-center mt-8">
            <button
              onClick={handleBuyNow}
              disabled={!selectedProductId}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {L({ zh: "立即购买", en: "Buy Now" })}
            </button>
          </div>
        </section>

        {/* Info Section */}
        <div className="mt-16 bg-slate-800/30 rounded-2xl border border-slate-700 p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-white mb-4">
            {L({ zh: "如何使用", en: "How It Works" })}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-indigo-300 mb-2">1. {L({ zh: "选择产品", en: "Choose Your Product" })}</h3>
              <p className="text-slate-400">{L({ zh: "根据您的交易所和保险需求选择合适的保险产品", 
                                              en: "Select an insurance product based on your exchange and coverage needs." })}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-indigo-300 mb-2">2. {L({ zh: "连接钱包", en: "Connect Wallet" })}</h3>
              <p className="text-slate-400">{L({ zh: "连接您的MetaMask钱包并确保在Base网络上", 
                                              en: "Connect your MetaMask wallet and ensure you're on Base network." })}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-indigo-300 mb-2">3. {L({ zh: "支付保费", en: "Pay Premium" })}</h3>
              <p className="text-slate-400">{L({ zh: "使用USDC支付保险保费以激活您的保险", 
                                              en: "Pay the insurance premium in USDC to activate your coverage." })}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-indigo-300 mb-2">4. {L({ zh: "自动保护", en: "Automatic Protection" })}</h3>
              <p className="text-slate-400">{L({ zh: "您的头寸现在受到保护，理赔将自动处理", 
                                              en: "Your position is now protected. Claims are processed automatically." })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ); 
}