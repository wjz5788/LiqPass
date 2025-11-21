import React from 'react'

const CONTENT = `LiqPass — Base Ecosystem Fund Application Document
An insured gateway for retail leverage traders

Project Information
Project: LiqPass
Category: On-chain liquidation insurance
Network: Base Mainnet
Contract: 0x9552b58d323993f84d01e3744f175f47a9462f94
Repository: https://github.com/wjz5788/leverageguard-attestor
Website: https://wjz5788.com
Contact: zmshyc@gmail.com

Project Overview
LiqPass provides a secure entry point for retail traders engaging in high-leverage trading. Through its "premium-payout" mechanism, even risk-averse users can participate in derivative trading, thereby expanding on-chain transaction volumes, increasing fee revenue, and bringing new user groups to the Base ecosystem.

1. Why These Exchanges?
We prioritize integration with centralized contract platforms with top-tier liquidity and trading volume (Binance, OKX, Bybit, etc.), as these platforms offer high market depth, standardized liquidation identification fields, and stable interfaces, facilitating standardized verification processes and reproducible results.

According to statistics from multiple public data sources (CryptoRank, CoinMarketCap, CoinGecko, etc.) in the first half of 2025:
Binance Futures has consistently ranked first globally in both contract trading volume and Open Interest indicators;
OKX Futures and Bybit Futures remain in the second tier, with stable interfaces and consistent data structures.

Based on the above market structure, we have selected Binance / OKX / Bybit as our initial priority integration platforms to ensure data stability, interface compatibility, and international coverage for verification. The first version uses OKX as a verification sample, with subsequent integration of Binance and Gate.io.

Reference Sources:
CryptoRank — Derivatives Exchanges Ranking
CoinMarketCap — Derivatives Exchanges Rankings
CoinGecko — Binance Futures Statistics

2. Why Would Users Bind Exchange Information?
Core Purpose
The sole purpose of binding is to verify the authenticity of liquidation events. When users submit a liquidation order number, the system verifies through read-only interfaces:
whether the order actually exists;
whether the time, underlying asset, leverage, settlement price, etc., match;
whether it is indeed a liquidation (fields contain LIQUIDATION or ADL);
whether the order belongs to the user本人而非伪造.

Security and Minimal Authorization
A natural user typically owns multiple exchange accounts, but when using LiqPass, only one exchange needs to be bound;
Authorization type is read-only permission (Read-Only), with no trading, withdrawal, or transfer capabilities;
We recommend separating main accounts from high-leverage accounts to ensure fund security;
For example:
If a user primarily trades on OKX daily, it is recommended to bind a Binance account as a protection account;
If primarily on Binance, binding OKX is recommended;
If active on both, Gate.io or another backup exchange can be chosen.
Users can open multiple high-leverage positions on their selected exchange without needing to bind multiple platforms;
Data is only used when users file claims, with no continuous monitoring or background fetching.

> In short: LiqPass operates on the logic of "minimum necessary authorization + account isolation," which can complete liquidation verification while maximizing the protection of user fund security.

3. Product and Claim Process
Current Product
Currently, only fixed-amount liquidation protection based on principal and leverage is offered. When purchasing, users input principal and leverage, and the system automatically calculates premiums and corresponding payout amounts.

Purchase Process (Overview)
1. Connect wallet and log in;
2. Select exchange and fill in read-only information;
3. Input principal and leverage parameters;
4. System calculates premium and payout amount;
5. Policy takes effect after payment.

Claim Process (Passive Mechanism)
LiqPass implements a passive claim mechanism and does not actively monitor user transactions. After liquidation, users submit order numbers or JSON files, and the system checks order details against the policy locally. If information matches, a payout is initiated; if automatic checking fails, users can submit screenshots and explanations for manual review.

Currently, a "local offline checking + summary on-chain" approach is adopted. Due to cloud servers located in the US with unstable access to OKX/Binance interfaces, only order summaries are generated into Merkle Roots and uploaded to the chain for public verification.

4. Data and Privacy
User data is encrypted during front-end transmission and only stored in ciphertext;
Complete transaction details are not retained, only verification summaries;
After claim completion, summaries are generated into Merkle Roots and uploaded to the chain;
Users can unbind and delete binding information at any time;
On-chain records do not contain any personally identifiable information.

5. Pricing and Risk Control Description
Pricing Principle
Premiums are calculated by the system based on a comprehensive model of risk probability, payout ceiling, and operating costs, ensuring the sustainability, fairness, and transparency of the fund pool in the long term.

Risk Control and Anti-Fraud
Setting waiting periods and payout ceilings to prevent arbitrage;
Identifying abnormal accounts and repeated claims;
Enabling blacklists and manual risk control switches.

6. Contact Information
Email: zmshyc@gmail.com
Website: https://wjz5788.com
Repository: https://github.com/wjz5788/LiqPass
Base Mainnet Contract: 0xC423C34b57730Ba87FB74b99180663913a345D68

This document is for the Base Ecosystem Fund application phase; the final launch version may be adjusted.`;

export default function DocEN() {
  return (
    <article className="mx-auto max-w-4xl rounded-2xl border bg-white/80 p-6 shadow-sm">
      <h2 className="text-2xl font-bold mb-4">English Document</h2>
      <div className="text-stone-800 leading-8 tracking-wide whitespace-pre-wrap">
        {CONTENT}
      </div>
    </article>
  )
}
