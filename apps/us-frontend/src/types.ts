// 钱包状态接口
export interface WalletState {
  address: string;
  chainId: string;
  onBase: boolean;
  busy: boolean;
  message: string;
  setMessage: (s: string) => void;
  connectWallet: () => Promise<void>;
  switchToBase: (testnet?: boolean) => Promise<void>;
  disconnectWallet?: () => void;
}

// Toast项目接口
export interface ToastItem {
  id: string;
  title: string;
  desc?: string;
  type?: "info" | "success" | "error";
}

// 导航项接口
export interface NavItem {
  label: string;
  to: string;
  exact?: boolean;
}

// 数据表格列定义
export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

// 面包屑项接口
export interface BreadcrumbItem {
  to?: string;
  label: string;
}

// 国际化字典类型
export interface Dictionary {
  home: string;
  links: string;
  createLink: string;
  createLinkDesc: string;
  copied: string;
  copyFailed: string;
  walletRequired: string;
  connectWalletFirst: string;
  fillAllFields: string;
  hero: {
    badge: string;
    title: string;
    subtitle: string;
  };
  noWallet: string;
  linkCreated: string;
  creationFailed: string;
  product: string;
  symbol: string;
  amount: string;
  duration: string;
  nav: {
    home: string;
    links: string;
    create: string;
    docs: string;
    legal: string;
    products: string;
    verify: string;
    transparency: string;
    help: string;
  };
  account: {
    profile: string;
    settings: string;
    logout: string;
    orders: string;
    claims: string;
    apiSettings: string;
    me: string;
    connectPrompt: string;
    close: string;
  };
  wallet: {
    connect: string;
    disconnect: string;
    switchNetwork: string;
    connected: string;
    notConnected: string;
  };
  copy: string;
  gotoAdvanced: string;
  previewTitle: string;
  previewHint: string;
  yes: string;
  no: string;
  // CreateLink 扩展
  selectProduct: string;
  productOption24h: string;
  productOption7d: string;
  productOption30d: string;
  selectSymbol: string;
  inputAmountPlaceholder: string;
  inputDurationPlaceholder: string;
  hours: string;
  fillFormToPreview: string;
  // Products 页面
  productsTitle: string;
  productsSubtitle: string;
  product24hTitle: string;
  range: string;
  leverageX: string;
  pricingFactorK: string;
  defaultFixed: string;
  finalFeeFormula: string;
  featuresTitle: string;
  feature24hWindow: string;
  featureAutoPayout: string;
  featureOnchainUSDC: string;
  featureTransparentPricing: string;
  coverageDetails: string;
  rowPrincipal: string;
  rowLeverage: string;
  rowPricingFactor: string;
  rowBaseFee: string;
  rowFinalFee: string;
  rowFeeAmount: string;
  rowPayoutRate: string;
  rowPayoutAmount: string;
  buying: string;
  buyNow: string;
  buyFlowHint: string;
  paymentStarted: string;
  paymentFailed: string;
  product24hShort: string;
  transparency: {
    title: string;
    refresh: string;
    loading: string;
    kpiSold7d: string;
    kpiPremium7d: string;
    kpiPaid7d: string;
    kpiLossRatio7d: string;
    kpiActivePolicies: string;
    kpiTreasuryBalance: string;
    chartDailyPremiumPaid: string;
    cumulative: string;
    premium: string;
    paid: string;
    gaugeReserveAdequacy: string;
    gaugeBalance: string;
    gaugeRequired: string;
    gaugeStateOk: string;
    gaugeStateWarn: string;
    gaugeStateCritical: string;
    gaugeMissingRequired: string;
    donutBucketTitle: string;
    donutCount: string;
    donutPremium: string;
    donutTotalPrefix: string;
    donutTotalSuffixCount: string;
    eventsTitle: string;
    eventsNone: string;
    tableTimeUTC: string;
    tableEvent: string;
    tableAmount: string;
    tableDigest: string;
    tableTx: string;
    tableView: string;
    auditTitle: string;
    auditExpand: string;
    auditCollapse: string;
    auditContractsChain: string;
    auditLatestDocHash: string;
    auditEvidenceRoots: string;
    copy: string;
  };
  helpPage: {
    title: string;
    faqTitle: string;
    qWhatIs: string;
    aWhatIs: string;
    qHowCreateLink: string;
    aHowCreateLink: string;
    qHowTransparency: string;
    aHowTransparency: string;
    contactTitle: string;
    contactEmailLabel: string;
    contactDiscordLabel: string;
    contactTelegramLabel: string;
  };
}

// API配置接口
export interface ApiConfig {
  base: string;
  readKey: string;
}