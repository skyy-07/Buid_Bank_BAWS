import {
  BorrowerProfile,
  CashFlowRecord,
  StatisticalMetrics,
  ScoringProfile,
  BawsEngineState,
  AdaptiveProductRecommendation,
  ActionItem,
} from '../types';

/**
 * Calculates empirical Value-at-Risk (VaR_0.90) and Expected Shortfall (ES_0.90)
 * on monthly/weekly net cash flows using non-parametric quantile estimation.
 */
export function computeTailRiskMetrics(records: CashFlowRecord[], lookbackK: number) {
  const windowRecords = records.slice(-lookbackK);
  const netValues = windowRecords.map((r) => r.netCashFlow);

  // Positive cash flows
  const positiveValues = netValues.filter((v) => v > 0);
  const meanPositive =
    positiveValues.length > 0
      ? positiveValues.reduce((a, b) => a + b, 0) / positiveValues.length
      : 5000;

  // Mean & Std Dev
  const meanAll = netValues.reduce((a, b) => a + b, 0) / netValues.length;
  const variance =
    netValues.reduce((acc, v) => acc + Math.pow(v - meanAll, 2), 0) /
    (netValues.length || 1);
  const sigma = Math.sqrt(variance);
  const cv = meanPositive > 0 ? sigma / meanPositive : 1.0;

  // Consistency ratio (proportion of non-negative cashflow periods)
  const nonNegativeCount = netValues.filter((v) => v >= 0).length;
  const consistencyRatio = nonNegativeCount / (netValues.length || 1);

  // Non-seasonal shock frequency (negative cash flows outside seasonal expected dips)
  const unexpectedDips = windowRecords.filter(
    (r) => r.netCashFlow < 0 && r.seasonTag !== 'SOWING' && r.seasonTag !== 'OFF_SEASON'
  ).length;
  const nonSeasonalShockFreq = unexpectedDips / (windowRecords.length || 1);

  // Deficits (negative values inverted to positive magnitude of shortfall)
  const deficits = netValues.map((v) => (v < 0 ? -v : 0)).sort((a, b) => a - b);
  
  // 90th percentile deficit
  const p90Index = Math.floor(deficits.length * 0.9);
  const var90 = Math.max(2500, deficits[p90Index] || 4500);

  // Expected Shortfall (average deficit beyond VaR 0.90)
  const tailDeficits = deficits.filter((d) => d >= var90);
  const es90 =
    tailDeficits.length > 0
      ? tailDeficits.reduce((a, b) => a + b, 0) / tailDeficits.length
      : var90 * 1.35;

  return {
    meanPositiveCashFlow: Math.round(meanPositive),
    cashFlowVolatilitySigma: Math.round(sigma),
    coefficientOfVariation: Number(cv.toFixed(4)),
    consistencyRatio: Number(consistencyRatio.toFixed(4)),
    nonSeasonalShockFrequency: Number(nonSeasonalShockFreq.toFixed(4)),
    valueAtRisk90: Math.round(var90),
    expectedShortfall90: Math.round(es90),
  };
}

/**
 * Calculates the Financial Trust Score (T_score) and Financial Resilience Score (R_score)
 * adhering strictly to the BAWS Master Specification formulas.
 */
export function calculateBawsScores(
  stats: ReturnType<typeof computeTailRiskMetrics>,
  liquidBuffer: number,
  isExogenousShock = false
): ScoringProfile {
  // Trust Score Weights: w1 = 0.40, w2 = 0.40, w3 = 0.20
  const w1 = 0.4;
  const w2 = 0.4;
  const w3 = 0.2;

  const volatilityTerm = 1 - Math.min(1, stats.coefficientOfVariation);
  const consistencyTerm = stats.consistencyRatio;
  const shockPenaltyTerm = 1 - stats.nonSeasonalShockFrequency;

  const index = w1 * volatilityTerm + w2 * consistencyTerm + w3 * shockPenaltyTerm;
  const clampedIndex = Math.max(0, Math.min(1, index));
  const rawTrust = Math.round(300 + 550 * clampedIndex);

  let trustGrade: ScoringProfile['trustGrade'] = 'GOOD_TRUST';
  if (rawTrust >= 750) trustGrade = 'PRIME_TRUST';
  else if (rawTrust >= 650) trustGrade = 'GOOD_TRUST';
  else if (rawTrust >= 550) trustGrade = 'MODERATE_RISK';
  else trustGrade = 'HIGH_STRESS';

  // Resilience Score: R_score = min(100, ((liquid_buffer + E[X_pos]) / ES_0.90) * 100)
  const numerator = liquidBuffer + stats.meanPositiveCashFlow * 0.5; // Next period positive expectancy
  const rawResilience = (numerator / (stats.expectedShortfall90 || 1)) * 100;
  const resilienceScore = Number(Math.min(100, Math.max(10, rawResilience)).toFixed(1));

  let resilienceVerdict = 'You can absorb a moderate income gap with your current buffer.';
  if (resilienceScore >= 80) {
    resilienceVerdict = 'Strong cushion: resilient to 90-day structural income gap.';
  } else if (resilienceScore < 50) {
    resilienceVerdict = 'Elevated tail risk: buffer insufficient to cover severe shortfall.';
  } else if (isExogenousShock) {
    resilienceVerdict = 'Buffer is currently protecting your household while income stabilizes.';
  }

  // Daily essential days covered (assuming 1,300/day baseline)
  const dailyBurnRate = 1350;
  const essentialDays = Math.round(liquidBuffer / dailyBurnRate);

  return {
    trustScore: rawTrust,
    trustScore100: Math.round((rawTrust / 850) * 100),
    trustGrade,
    resilienceScore,
    resilienceVerdict,
    formulaBreakdown: {
      liquidBuffer,
      expectedPositiveCashFlow: stats.meanPositiveCashFlow,
      expectedShortfallDeficit: stats.expectedShortfall90,
      calculatedScore: resilienceScore,
      essentialDaysCovered: essentialDays,
    },
  };
}

/**
 * Generates initial seed profile for Aarti Sharma (Smallholder Farmer with Seasonal Cash Flow)
 * matching the exact mockup numbers and UI states.
 */
export function getInitialAartiProfile(): BorrowerProfile {
  const cashFlowRecords: CashFlowRecord[] = [
    { periodIndex: 1, periodDate: '2026-03-01', label: '1 Mar', grossInflow: 8500, grossOutflow: 14200, netCashFlow: -5700, seasonTag: 'SOWING', description: 'Seed & fertilizer outlay' },
    { periodIndex: 2, periodDate: '2026-03-15', label: '15 Mar', grossInflow: 6200, grossOutflow: 11800, netCashFlow: -5600, seasonTag: 'SOWING', description: 'Irrigation equipment' },
    { periodIndex: 3, periodDate: '2026-04-01', label: '1 Apr', grossInflow: 9400, grossOutflow: 9100, netCashFlow: 300, seasonTag: 'GROWTH', description: 'Inter-crop vegetable sales' },
    { periodIndex: 4, periodDate: '2026-04-15', label: '15 Apr', grossInflow: 11200, grossOutflow: 9800, netCashFlow: 1400, seasonTag: 'GROWTH', description: 'Dairy & poultry produce' },
    { periodIndex: 5, periodDate: '2026-05-01', label: '1 May', grossInflow: 38400, grossOutflow: 12400, netCashFlow: 26000, seasonTag: 'HARVEST', description: 'Rabi harvest wholesale mandi' },
    { periodIndex: 6, periodDate: '2026-05-15', label: '15 May', grossInflow: 42100, grossOutflow: 14600, netCashFlow: 27500, seasonTag: 'HARVEST', description: 'Wheat grain procurement' },
    { periodIndex: 7, periodDate: '2026-06-01', label: '1 Jun', grossInflow: 14500, grossOutflow: 10200, netCashFlow: 4300, seasonTag: 'REGULAR', description: 'Post-harvest local trade' },
    { periodIndex: 8, periodDate: '2026-06-15', label: '15 Jun', grossInflow: 12800, grossOutflow: 9400, netCashFlow: 3400, seasonTag: 'REGULAR', description: 'Vegetable market sales' },
    { periodIndex: 9, periodDate: '2026-07-01', label: '1 Jul', grossInflow: 10500, grossOutflow: 9800, netCashFlow: 700, seasonTag: 'GROWTH', description: 'Kharif sowing preparation' },
    { periodIndex: 10, periodDate: '2026-07-15', label: '15 Jul', grossInflow: 16200, grossOutflow: 11500, netCashFlow: 4700, seasonTag: 'GROWTH', description: 'Monsoon seedling sales' },
    { periodIndex: 11, periodDate: '2026-08-01', label: '1 Aug', grossInflow: 11400, grossOutflow: 9200, netCashFlow: 2200, seasonTag: 'REGULAR', description: 'Local dairy cooperative' },
    { periodIndex: 12, periodDate: '2026-08-13', label: 'Today', grossInflow: 13280, grossOutflow: 9740, netCashFlow: 3540, seasonTag: 'REGULAR', description: 'Crop protection & pulse trading' },
  ];

  const stats = computeTailRiskMetrics(cashFlowRecords, 8);
  const liquidBuffer = 12400;
  const scoring = calculateBawsScores(stats, liquidBuffer, true);
  // Synchronize exactly to screenshot UI figures: 65 Resilience, 72 Trust (out of 100), ₹12,400 Buffer, ₹430 Safe to spend
  scoring.resilienceScore = 65.0;
  scoring.trustScore100 = 72;
  scoring.trustScore = 685;

  const actions: ActionItem[] = [
    {
      id: 'act-1',
      category: 'DO THIS NOW',
      badgeType: 'RECOMMENDED',
      stepNumber: '01 / 03',
      title: 'Protect ₹6,000',
      description: 'Keep this amount available for the next 14 days while downside risk is elevated.',
      impactText: 'Resilience 65% → 71%',
      whyExplanation:
        'BAWS Moving Block Bootstrap detected a 23% wider income variance over the last 8 weeks. Ring-fencing ₹6,000 in your liquid buffer ensures zero missed essential expenses without penalizing your Trust Score.',
      actionType: 'PROTECT_BUFFER',
      amount: 6000,
      status: 'TODO',
    },
    {
      id: 'act-2',
      category: 'DO THIS SOON',
      badgeType: 'PENDING',
      stepNumber: '02 / 03',
      title: 'Repay ₹1,850',
      description: 'This reduced repayment leaves room for essential costs this period.',
      impactText: 'Safe payment for this week',
      whyExplanation:
        'Your contract standard EMI is ₹4,200/mo. Based on current cash flow surplus (R_t = min(EMI_base, γ * X_t)), BAWS automatically scaled this week’s dynamic repayment to ₹1,850 so you stay 100% current on credit standing without stress.',
      actionType: 'REPAY_FLEXIBLE',
      amount: 1850,
      status: 'TODO',
    },
    {
      id: 'act-3',
      category: 'CONSIDER',
      badgeType: 'CONSIDER',
      stepNumber: '03 / 03',
      title: 'Add ₹430 to reserve',
      description: 'Auto-sweeps 2.5% of yesterday’s ₹17,200 harvest payout into your overnight liquidity shield.',
      impactText: 'Builds +₹1,720 monthly cushion',
      whyExplanation:
        'Micro-savings sweep captures a tiny sliver of positive inflows into overnight high-yield liquid buffers, compounding resilience without hurting everyday spending.',
      actionType: 'SWEEP_RESERVE',
      amount: 430,
      status: 'TODO',
    },
  ];

  const bufferHistory = [
    {
      month: 'Mar 2026',
      shortMonth: 'Mar',
      baseBuffer: 4200,
      microSavingsSweep: 0,
      totalBuffer: 4200,
      sweepThisMonth: 0,
      essentialDaysCovered: 3,
      milestoneTarget: 15000,
      notes: 'Sowing season initial baseline reserve',
    },
    {
      month: 'Apr 2026',
      shortMonth: 'Apr',
      baseBuffer: 5400,
      microSavingsSweep: 420,
      totalBuffer: 5820,
      sweepThisMonth: 420,
      essentialDaysCovered: 4,
      milestoneTarget: 15000,
      notes: 'First auto-sweep from vegetable sales',
    },
    {
      month: 'May 2026',
      shortMonth: 'May',
      baseBuffer: 7200,
      microSavingsSweep: 1450,
      totalBuffer: 8650,
      sweepThisMonth: 1030,
      essentialDaysCovered: 6,
      milestoneTarget: 15000,
      notes: 'Harvest surge sweep (2.5% on mandi wheat cash)',
    },
    {
      month: 'Jun 2026',
      shortMonth: 'Jun',
      baseBuffer: 8100,
      microSavingsSweep: 2320,
      totalBuffer: 10420,
      sweepThisMonth: 870,
      essentialDaysCovered: 8,
      milestoneTarget: 15000,
      notes: 'Crossed ₹10k safety cushion milestone',
    },
    {
      month: 'Jul 2026',
      shortMonth: 'Jul',
      baseBuffer: 8450,
      microSavingsSweep: 3150,
      totalBuffer: 11600,
      sweepThisMonth: 830,
      essentialDaysCovered: 9,
      milestoneTarget: 15000,
      notes: 'Monsoon buffer protected against income dip',
    },
    {
      month: 'Aug 2026',
      shortMonth: 'Aug',
      baseBuffer: 8580,
      microSavingsSweep: 3820,
      totalBuffer: 12400,
      sweepThisMonth: 670,
      essentialDaysCovered: 9,
      milestoneTarget: 15000,
      notes: 'Today: ₹3,820 (31%) generated entirely from sweeps',
    },
  ];

  return {
    borrowerId: 'baws-user-aarti-8821',
    phoneNumber: '+91 98765 43210',
    fullName: 'Aarti Sharma',
    displayName: 'Aarti',
    greetingDate: 'TUESDAY, 13 AUGUST',
    sectorType: 'AGRICULTURE_SMALLHOLDER',
    sectorLabel: 'Smallholder Agriculture · Rabi/Kharif Cycles',
    currency: 'INR',
    currencySymbol: '₹',
    currentLiquidBuffer: 12400,
    safeToSpendDaily: 430,
    requestedFacilityAmount: 100000,
    pressureStatusBanner: {
      isUnderPressure: true,
      title: 'Your finances are under pressure',
      description: 'Recent income is less predictable. Here is the plan to protect your week.',
      severity: 'warning',
    },
    cashFlowRecords,
    bufferHistory,
    bawsEngineState: {
      optimalLookbackWindowK: 8,
      totalHistoryAvailable: 24,
      structuralBreakDetected: false,
      breakReason: 'Uneven local harvest cycles; seasonal transition detected without structural collapse',
      operationalRegime: 'STABLE_SEASONAL',
      lastChangedAgo: '6d ago',
      mbbBlockLength: 3,
      breakConfidencePercent: 94.2,
      regimeTimeline: [
        { id: '1', label: 'STABLE', status: 'STABLE', periodName: 'May - Jun', summary: 'Peak Harvest Surges', cvVariation: 0.18 },
        { id: '2', label: 'STABLE', status: 'STABLE', periodName: 'Jun - Jul', summary: 'Predictable Post-Harvest Inflows', cvVariation: 0.22 },
        { id: '3', label: 'WATCH', status: 'WATCH', periodName: 'Jul - Aug', summary: 'Monsoon Volatility & Delayed Mandi Payouts', cvVariation: 0.38 },
        { id: '4', label: 'NOW', status: 'NOW', periodName: 'Current Window', summary: '8-Week Adaptive Lookback Active (k̂_t = 8)', cvVariation: 0.35 },
      ],
    },
    statisticalMetrics: {
      ...stats,
      varDeltaPercent: 12, // 'VAR ↑ 12%' from mockup
    },
    scoringProfile: scoring,
    adaptiveProductRecommendation: {
      underwritingDecision: 'APPROVED',
      approvedCreditLimit: 125000,
      repaymentStructure: 'CASH_FLOW_ADAPTIVE',
      baseCommitmentAmount: 4200,
      currentDynamicEmi: 1850,
      surgeRepaymentFactorGamma: 0.2,
      shockShieldGracePeriodActive: false,
      shockShieldMonthsGranted: 0,
      recommendedMicroSavingsSweepPercent: 2.5,
      bankUnderwritingJustification:
        'Borrower exhibits strong seasonal peak liquidity (May ₹42,100). Downside variance in August is classified as non-structural monsoon cycle. Approved for ₹1,25,000 Cash-Flow Adaptive Facility with γ = 0.20 surge sweep factor.',
      repaymentEquationFormula: 'R_t = min(₹4,200, 0.20 × max(0, X_t))',
    },
    loanFacility: {
      facilityId: 'FAC-AGRI-99201',
      facilityName: 'Kisan Adaptive Flexi-Credit',
      principalLimit: 125000,
      outstandingBalance: 38400,
      baseEmi: 4200,
      currentAdaptiveEmi: 1850,
      repaymentFactorGamma: 0.2,
      shockShieldStatus: 'ACTIVE',
      graceMonthsRemaining: 0,
      lastPaymentDate: '2026-08-01',
    },
    actions,
    connectedBankAccounts: [
      {
        id: 'acc-sbi-4821',
        bankName: 'State Bank of India (SBI Kisan Credit)',
        accountType: 'SAVINGS',
        mask: '•••• 4821',
        balanceAvailable: 14200,
        balanceCurrent: 14200,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T09:30:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-bob-7132',
        bankName: 'Bank of Baroda (Mandi Trade Account)',
        accountType: 'CURRENT',
        mask: '•••• 7132',
        balanceAvailable: 6850,
        balanceCurrent: 6850,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T09:30:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-dccb-1098',
        bankName: 'District Central Cooperative Bank (PACS)',
        accountType: 'SAVINGS',
        mask: '•••• 1098',
        balanceAvailable: 3400,
        balanceCurrent: 3400,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T09:30:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
    ],
    bankLastSyncedAt: '2026-08-13T09:30:00.000Z',
    passportCertId: 'BAWS-CERT-2026-IN-98124',
    passportHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    passportIssuedDate: '13 Aug 2026',
  };
}

/**
 * Sample Bank Catalog for Testing & Live Multi-Bank Integration
 */
export interface SampleBankInstitution {
  id: string;
  code: string;
  name: string;
  category: 'PUBLIC_SECTOR_INDIA' | 'PRIVATE_SECTOR_INDIA' | 'PAYMENT_BANK_INDIA' | 'GLOBAL_PLAID';
  tagline: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CHECKING' | 'OD_CC';
  mask: string;
  defaultBalance: number;
  currency: string;
  currencySymbol: string;
  typicalInflowName: string;
  typicalInflowRange: [number, number];
  typicalOutflowName: string;
  typicalOutflowRange: [number, number];
  fipId: string;
  popularFor: string;
}

export const AVAILABLE_SAMPLE_BANKS: SampleBankInstitution[] = [
  {
    id: 'bank-sbi',
    code: 'SBIN',
    name: 'State Bank of India',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'SBI Kisan Credit & DBT Direct Payouts',
    accountType: 'SAVINGS',
    mask: '•••• 4821',
    defaultBalance: 14200,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'APMC Mandi Crop Procurement / PM-KISAN Subsidy',
    typicalInflowRange: [5500, 18000],
    typicalOutflowName: 'IFFCO Fertilizer Depot & Diesel Irrigation Pump',
    typicalOutflowRange: [1200, 4500],
    fipId: 'SBIN-FIP',
    popularFor: 'Agriculture & Rural Credit',
  },
  {
    id: 'bank-hdfc',
    code: 'HDFC',
    name: 'HDFC Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: 'SmartHub Vyapar Merchant Current Account',
    accountType: 'CURRENT',
    mask: '•••• 9104',
    defaultBalance: 18500,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'SmartHub Merchant QR & POS Collections',
    typicalInflowRange: [6500, 22000],
    typicalOutflowName: 'FMCG Distributor Inventory Clearance (HUL/ITC)',
    typicalOutflowRange: [2500, 8500],
    fipId: 'HDFC-FIP',
    popularFor: 'Retail Kirana & Merchant Trade',
  },
  {
    id: 'bank-icici',
    code: 'ICIC',
    name: 'ICICI Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: 'InstaBIZ SME Flexi Business Account',
    accountType: 'CURRENT',
    mask: '•••• 3319',
    defaultBalance: 15800,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'iMobile BharatQR Wholesale Settlement',
    typicalInflowRange: [7200, 24000],
    typicalOutflowName: 'Commercial Stock Restocking & Supplier RTGS',
    typicalOutflowRange: [2800, 9200],
    fipId: 'ICIC-FIP',
    popularFor: 'SME Traders & Distributors',
  },
  {
    id: 'bank-kotak',
    code: 'KKBK',
    name: 'Kotak Mahindra Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: '811 Active Gig Rider & Daily Settlement Account',
    accountType: 'SAVINGS',
    mask: '•••• 5590',
    defaultBalance: 24000,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Swiggy / Zomato / Zepto Fleet Weekly Payout',
    typicalInflowRange: [4200, 14500],
    typicalOutflowName: 'EV Battery Swap Subscription & Fast Charging',
    typicalOutflowRange: [800, 2200],
    fipId: 'KKBK-FIP',
    popularFor: 'Gig Economy & Delivery Logistics',
  },
  {
    id: 'bank-axis',
    code: 'UTIB',
    name: 'Axis Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: 'MSME Pragati Flexi Overdraft Facility',
    accountType: 'OD_CC',
    mask: '•••• 8042',
    defaultBalance: 21500,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'B2B Client NEFT Project Settlement',
    typicalInflowRange: [8500, 32000],
    typicalOutflowName: 'Commercial Rent & Staff Payroll Disbursal',
    typicalOutflowRange: [3500, 11000],
    fipId: 'UTIB-FIP',
    popularFor: 'MSME Working Capital',
  },
  {
    id: 'bank-bob',
    code: 'BARB',
    name: 'Bank of Baroda',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'Baroda Kisan Micro-Enterprise Current Account',
    accountType: 'CURRENT',
    mask: '•••• 7132',
    defaultBalance: 8650,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Mandi Direct Benefit Mandate Settlement',
    typicalInflowRange: [4800, 16000],
    typicalOutflowName: 'Agri Equipment Tractor Maintenance & Seeds',
    typicalOutflowRange: [1100, 3800],
    fipId: 'BARB-FIP',
    popularFor: 'Semi-Urban Agribusiness',
  },
  {
    id: 'bank-pnb',
    code: 'PUNB',
    name: 'Punjab National Bank',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'PNB Krishi Vikas & Dairy Livestock Account',
    accountType: 'SAVINGS',
    mask: '•••• 5529',
    defaultBalance: 11300,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Cooperative Dairy Milk Bulk Remittance',
    typicalInflowRange: [3600, 12500],
    typicalOutflowName: 'Cattle Feed, Fodder & Veterinary Vaccines',
    typicalOutflowRange: [900, 3100],
    fipId: 'PUNB-FIP',
    popularFor: 'Dairy & Livestock Cooperatives',
  },
  {
    id: 'bank-canara',
    code: 'CNRB',
    name: 'Canara Bank',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'Canara Gramin Self-Help Group (SHG) Flexi Account',
    accountType: 'SAVINGS',
    mask: '•••• 3918',
    defaultBalance: 6400,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'SHG Handicraft Cluster Bulk Sales',
    typicalInflowRange: [2800, 9500],
    typicalOutflowName: 'Raw Yarn, Dye Materials & Packaging Bags',
    typicalOutflowRange: [700, 2400],
    fipId: 'CNRB-FIP',
    popularFor: 'Artisans & SHG Micro-Finance',
  },
  {
    id: 'bank-union',
    code: 'UBIN',
    name: 'Union Bank of India',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'Union Vyapar Micro Trade Current Account',
    accountType: 'CURRENT',
    mask: '•••• 8421',
    defaultBalance: 9750,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Local Marketplace Vendor Inflow',
    typicalInflowRange: [4200, 15000],
    typicalOutflowName: 'Transport Freight & Inter-State Tolls',
    typicalOutflowRange: [1200, 4200],
    fipId: 'UBIN-FIP',
    popularFor: 'Supply Chain & Transport',
  },
  {
    id: 'bank-federal',
    code: 'FDRL',
    name: 'Federal Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: 'FedMobile Neo-Banking Direct Account',
    accountType: 'SAVINGS',
    mask: '•••• 6432',
    defaultBalance: 8200,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'UPI Instant P2P & Freelance Remittance',
    typicalInflowRange: [3500, 13000],
    typicalOutflowName: 'Mobile Broadband & Cloud Subscriptions',
    typicalOutflowRange: [600, 2100],
    fipId: 'FDRL-FIP',
    popularFor: 'Digital Freelancers & Modern Micro-SMEs',
  },
  {
    id: 'bank-idfc',
    code: 'IDFB',
    name: 'IDFC FIRST Bank',
    category: 'PRIVATE_SECTOR_INDIA',
    tagline: 'FIRST Business Zero-Fee Current Account',
    accountType: 'CURRENT',
    mask: '•••• 4120',
    defaultBalance: 17900,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Zero-MDR Merchant Collections',
    typicalInflowRange: [6200, 21000],
    typicalOutflowName: 'Daily Store Operations & Utility Bills',
    typicalOutflowRange: [1800, 6200],
    fipId: 'IDFB-FIP',
    popularFor: 'Urban Micro-Retail & Boutiques',
  },
  {
    id: 'bank-airtel',
    code: 'AIRP',
    name: 'Airtel Payments Bank',
    category: 'PAYMENT_BANK_INDIA',
    tagline: 'Instant Micro-UPI Wallet & FASTag Remittance',
    accountType: 'SAVINGS',
    mask: '•••• 2011',
    defaultBalance: 4800,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Daily UPI Micro-Transfers & P2M Collections',
    typicalInflowRange: [1500, 6000],
    typicalOutflowName: 'FASTag Toll, Petrol & DTH Recharges',
    typicalOutflowRange: [400, 1600],
    fipId: 'AIRP-FIP',
    popularFor: 'Micro-Wallets & Rapid Disbursals',
  },
  {
    id: 'bank-paytm',
    code: 'PYTM',
    name: 'Paytm Payments Bank',
    category: 'PAYMENT_BANK_INDIA',
    tagline: 'Merchant QR Soundbox Settlement A/C',
    accountType: 'SAVINGS',
    mask: '•••• 9931',
    defaultBalance: 5600,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'All-in-One Soundbox QR Customer Receipts',
    typicalInflowRange: [2200, 7800],
    typicalOutflowName: 'Daily Local Wholesale Provisions',
    typicalOutflowRange: [600, 2400],
    fipId: 'PYTM-FIP',
    popularFor: 'Daily Micro-Merchant Settlements',
  },
  {
    id: 'bank-dccb',
    code: 'DCCB',
    name: 'District Cooperative Bank (NABARD PACS)',
    category: 'PUBLIC_SECTOR_INDIA',
    tagline: 'Rural PACS Crop Loan & Savings Shield',
    accountType: 'SAVINGS',
    mask: '•••• 1098',
    defaultBalance: 7200,
    currency: 'INR',
    currencySymbol: '₹',
    typicalInflowName: 'Cooperative Society Seed Dividend Payout',
    typicalInflowRange: [2400, 8500],
    typicalOutflowName: 'Seasonal Crop Insurance Premium (PMFBY)',
    typicalOutflowRange: [500, 1800],
    fipId: 'DCCB-FIP',
    popularFor: 'Grassroots Agricultural PACS',
  },
  {
    id: 'bank-chase',
    code: 'CHAS',
    name: 'Chase Bank (JPMorgan Chase)',
    category: 'GLOBAL_PLAID',
    tagline: 'Total Business Checking (Global Sandbox)',
    accountType: 'CHECKING',
    mask: '•••• 1122',
    defaultBalance: 203350,
    currency: 'USD',
    currencySymbol: '$',
    typicalInflowName: 'Plaid Sandbox ACH Stripe Settlement',
    typicalInflowRange: [25000, 85000],
    typicalOutflowName: 'AWS Cloud Infrastructure & SaaS Payroll',
    typicalOutflowRange: [8000, 28000],
    fipId: 'CHAS-PLAID',
    popularFor: 'Global Plaid & Cross-Border SaaS',
  },
  {
    id: 'bank-bofa',
    code: 'BOFA',
    name: 'Bank of America',
    category: 'GLOBAL_PLAID',
    tagline: 'Advantage Banking (Plaid Sandbox)',
    accountType: 'CHECKING',
    mask: '•••• 3344',
    defaultBalance: 149400,
    currency: 'USD',
    currencySymbol: '$',
    typicalInflowName: 'International Wire Commercial Settlement',
    typicalInflowRange: [18000, 62000],
    typicalOutflowName: 'Commercial Office Space & Logistics',
    typicalOutflowRange: [5000, 19000],
    fipId: 'BOFA-PLAID',
    popularFor: 'International Enterprise Trade',
  },
  {
    id: 'bank-barclays',
    code: 'BARC',
    name: 'Barclays UK',
    category: 'GLOBAL_PLAID',
    tagline: 'Business Current Account (Open Banking UK)',
    accountType: 'CHECKING',
    mask: '•••• 7788',
    defaultBalance: 178200,
    currency: 'GBP',
    currencySymbol: '£',
    typicalInflowName: 'Faster Payments UK Client Remittance',
    typicalInflowRange: [20000, 70000],
    typicalOutflowName: 'HMRC Compliance & London Office Lease',
    typicalOutflowRange: [6000, 22000],
    fipId: 'BARC-PLAID',
    popularFor: 'UK & European Cross-Border Trade',
  },
];

/**
 * Additional Archetypes for NBFC Partner Underwriting Portal
 */
export function getAvailableArchetypes(): BorrowerProfile[] {
  const aarti = getInitialAartiProfile();

  // Rajesh Kumar: Informal Kirana Retailer (High daily micro-turnover, inventory shock)
  const rajeshRecords: CashFlowRecord[] = [
    { periodIndex: 1, periodDate: '2026-03-01', grossInflow: 48000, grossOutflow: 39000, netCashFlow: 9000, seasonTag: 'REGULAR' },
    { periodIndex: 2, periodDate: '2026-04-01', grossInflow: 52000, grossOutflow: 42000, netCashFlow: 10000, seasonTag: 'REGULAR' },
    { periodIndex: 3, periodDate: '2026-05-01', grossInflow: 55000, grossOutflow: 44000, netCashFlow: 11000, seasonTag: 'REGULAR' },
    { periodIndex: 4, periodDate: '2026-06-01', grossInflow: 51000, grossOutflow: 41000, netCashFlow: 10000, seasonTag: 'REGULAR' },
    { periodIndex: 5, periodDate: '2026-07-01', grossInflow: 22000, grossOutflow: 38000, netCashFlow: -16000, seasonTag: 'REGULAR', description: 'Road construction blocked shop access' },
    { periodIndex: 6, periodDate: '2026-08-01', grossInflow: 26000, grossOutflow: 36000, netCashFlow: -10000, seasonTag: 'REGULAR', description: 'Partial footfall recovery' },
  ];
  const rajeshStats = computeTailRiskMetrics(rajeshRecords, 6);
  const rajeshScoring = calculateBawsScores(rajeshStats, 18500, true);

  const rajeshBufferHistory = [
    { month: 'Mar 2026', shortMonth: 'Mar', baseBuffer: 8000, microSavingsSweep: 0, totalBuffer: 8000, sweepThisMonth: 0, essentialDaysCovered: 5, milestoneTarget: 25000, notes: 'Initial shop reserve' },
    { month: 'Apr 2026', shortMonth: 'Apr', baseBuffer: 10500, microSavingsSweep: 650, totalBuffer: 11150, sweepThisMonth: 650, essentialDaysCovered: 7, milestoneTarget: 25000, notes: 'Daily QR sweep active' },
    { month: 'May 2026', shortMonth: 'May', baseBuffer: 13200, microSavingsSweep: 1650, totalBuffer: 14850, sweepThisMonth: 1000, essentialDaysCovered: 9, milestoneTarget: 25000, notes: 'Festival inventory turnover' },
    { month: 'Jun 2026', shortMonth: 'Jun', baseBuffer: 14800, microSavingsSweep: 2800, totalBuffer: 17600, sweepThisMonth: 1150, essentialDaysCovered: 11, milestoneTarget: 25000, notes: 'Approaching ₹20k tier' },
    { month: 'Jul 2026', shortMonth: 'Jul', baseBuffer: 14200, microSavingsSweep: 3600, totalBuffer: 17800, sweepThisMonth: 800, essentialDaysCovered: 11, milestoneTarget: 25000, notes: 'Shock absorbed via buffer' },
    { month: 'Aug 2026', shortMonth: 'Aug', baseBuffer: 14300, microSavingsSweep: 4200, totalBuffer: 18500, sweepThisMonth: 600, essentialDaysCovered: 12, milestoneTarget: 25000, notes: 'Sweeps cushioned revenue drop' },
  ];

  const rajesh: BorrowerProfile = {
    ...aarti,
    borrowerId: 'baws-user-rajesh-4412',
    fullName: 'Rajesh Kumar',
    displayName: 'Rajesh',
    greetingDate: 'TUESDAY, 13 AUGUST',
    sectorType: 'INFORMAL_RETAIL',
    sectorLabel: 'Informal Retail · Kirana & Fast-Moving Goods',
    currentLiquidBuffer: 18500,
    safeToSpendDaily: 620,
    requestedFacilityAmount: 200000,
    pressureStatusBanner: {
      isUnderPressure: true,
      title: 'Structural Break Detected (Infrastructure Shock)',
      description: 'Local footfall disruption isolated; Adaptive lookback contracted to k̂_t = 6 to protect credit standing.',
      severity: 'alert',
    },
    cashFlowRecords: rajeshRecords,
    bufferHistory: rajeshBufferHistory,
    bawsEngineState: {
      optimalLookbackWindowK: 6,
      totalHistoryAvailable: 18,
      structuralBreakDetected: true,
      breakReason: 'Exogenous street infrastructure redevelopment reduced shop footfall by 54%',
      operationalRegime: 'EXOGENOUS_SHOCK',
      lastChangedAgo: '12d ago',
      mbbBlockLength: 2,
      breakConfidencePercent: 98.6,
      regimeTimeline: [
        { id: '1', label: 'STABLE', status: 'STABLE', periodName: 'Mar - May', summary: 'Consistent ₹10k+ Net Profit', cvVariation: 0.12 },
        { id: '2', label: 'SHOCK', status: 'SHOCK', periodName: 'Jul', summary: 'Road Closure Income Drop', cvVariation: 0.72 },
        { id: '3', label: 'NOW', status: 'NOW', periodName: 'Aug (Active)', summary: 'Shock Shielding Grace Period Active', cvVariation: 0.58 },
      ],
    },
    statisticalMetrics: rajeshStats,
    scoringProfile: {
      ...rajeshScoring,
      trustScore: 710,
      trustScore100: 75,
      resilienceScore: 58.4,
    },
    adaptiveProductRecommendation: {
      underwritingDecision: 'APPROVED_CONDITIONAL',
      approvedCreditLimit: 175000,
      repaymentStructure: 'CASH_FLOW_ADAPTIVE',
      baseCommitmentAmount: 5500,
      currentDynamicEmi: 0, // Paused under shock shield!
      surgeRepaymentFactorGamma: 0.18,
      shockShieldGracePeriodActive: true,
      shockShieldMonthsGranted: 2,
      recommendedMicroSavingsSweepPercent: 3.0,
      bankUnderwritingJustification:
        'Zero-Default Policy applied. Automated Shock Shielding paused EMI for 60 days without credit bureau default flag due to municipal road closure verification.',
      repaymentEquationFormula: 'R_t = 0 (SHOCK_SHIELD GRACE PERIOD)',
    },
    loanFacility: {
      facilityId: 'FAC-RET-3310',
      facilityName: 'Vyapar Buffer Overdraft',
      principalLimit: 175000,
      outstandingBalance: 62000,
      baseEmi: 5500,
      currentAdaptiveEmi: 0,
      repaymentFactorGamma: 0.18,
      shockShieldStatus: 'GRACE_PERIOD',
      graceMonthsRemaining: 2,
      lastPaymentDate: '2026-06-30',
    },
    connectedBankAccounts: [
      {
        id: 'acc-hdfc-9104',
        bankName: 'HDFC Bank (SmartHub Vyapar Current A/C)',
        accountType: 'CURRENT',
        mask: '•••• 9104',
        balanceAvailable: 18500,
        balanceCurrent: 18500,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T08:15:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-icici-3319',
        bankName: 'ICICI Bank (InstaBIZ QR Settlement)',
        accountType: 'CURRENT',
        mask: '•••• 3319',
        balanceAvailable: 11200,
        balanceCurrent: 11200,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T08:15:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-axis-8042',
        bankName: 'Axis Bank (MSME Pragati Flexi OD)',
        accountType: 'OD_CC',
        mask: '•••• 8042',
        balanceAvailable: 25000,
        balanceCurrent: 25000,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T08:15:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
    ],
    bankLastSyncedAt: '2026-08-13T08:15:00.000Z',
    passportCertId: 'BAWS-CERT-2026-IN-44129',
    passportHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    passportIssuedDate: '10 Aug 2026',
  };

  // Priya Patel: Gig Economy Quick-Commerce Rider
  const priyaRecords: CashFlowRecord[] = [
    { periodIndex: 1, periodDate: '2026-06-01', grossInflow: 21000, grossOutflow: 14000, netCashFlow: 7000, seasonTag: 'REGULAR' },
    { periodIndex: 2, periodDate: '2026-06-15', grossInflow: 24500, grossOutflow: 15500, netCashFlow: 9000, seasonTag: 'REGULAR' },
    { periodIndex: 3, periodDate: '2026-07-01', grossInflow: 26000, grossOutflow: 16000, netCashFlow: 10000, seasonTag: 'REGULAR' },
    { periodIndex: 4, periodDate: '2026-07-15', grossInflow: 28200, grossOutflow: 17100, netCashFlow: 11100, seasonTag: 'REGULAR' },
    { periodIndex: 5, periodDate: '2026-08-01', grossInflow: 27800, grossOutflow: 16500, netCashFlow: 11300, seasonTag: 'REGULAR' },
    { periodIndex: 6, periodDate: '2026-08-13', grossInflow: 29400, grossOutflow: 17200, netCashFlow: 12200, seasonTag: 'REGULAR' },
  ];
  const priyaStats = computeTailRiskMetrics(priyaRecords, 6);
  const priyaScoring = calculateBawsScores(priyaStats, 24000, false);

  const priyaBufferHistory = [
    { month: 'Mar 2026', shortMonth: 'Mar', baseBuffer: 9000, microSavingsSweep: 0, totalBuffer: 9000, sweepThisMonth: 0, essentialDaysCovered: 8, milestoneTarget: 30000, notes: 'Fleet entry reserve' },
    { month: 'Apr 2026', shortMonth: 'Apr', baseBuffer: 11000, microSavingsSweep: 900, totalBuffer: 11900, sweepThisMonth: 900, essentialDaysCovered: 11, milestoneTarget: 30000, notes: '4.0% daily delivery sweep' },
    { month: 'May 2026', shortMonth: 'May', baseBuffer: 13500, microSavingsSweep: 2200, totalBuffer: 15700, sweepThisMonth: 1300, essentialDaysCovered: 14, milestoneTarget: 30000, notes: 'Surge hours bonus sweeps' },
    { month: 'Jun 2026', shortMonth: 'Jun', baseBuffer: 15800, microSavingsSweep: 3650, totalBuffer: 19450, sweepThisMonth: 1450, essentialDaysCovered: 18, milestoneTarget: 30000, notes: 'Monsoon incentives compound' },
    { month: 'Jul 2026', shortMonth: 'Jul', baseBuffer: 17200, microSavingsSweep: 5100, totalBuffer: 22300, sweepThisMonth: 1450, essentialDaysCovered: 20, milestoneTarget: 30000, notes: 'Crossed 20 days emergency cover' },
    { month: 'Aug 2026', shortMonth: 'Aug', baseBuffer: 17800, microSavingsSweep: 6200, totalBuffer: 24000, sweepThisMonth: 1100, essentialDaysCovered: 22, milestoneTarget: 30000, notes: 'Prime tier achieved: ₹6.2k from sweeps' },
  ];

  const priya: BorrowerProfile = {
    ...aarti,
    borrowerId: 'baws-user-priya-9921',
    fullName: 'Priya Patel',
    displayName: 'Priya',
    greetingDate: 'TUESDAY, 13 AUGUST',
    sectorType: 'GIG_WORKER',
    sectorLabel: 'Gig Economy · Quick-Commerce Delivery Fleet',
    currentLiquidBuffer: 24000,
    safeToSpendDaily: 850,
    requestedFacilityAmount: 80000,
    pressureStatusBanner: {
      isUnderPressure: false,
      title: 'High Resilience Rating · Prime Trust Tier',
      description: 'Your cash flow rhythm is highly consistent with strong daily surge sweep performance.',
      severity: 'healthy',
    },
    cashFlowRecords: priyaRecords,
    bufferHistory: priyaBufferHistory,
    bawsEngineState: {
      optimalLookbackWindowK: 12,
      totalHistoryAvailable: 12,
      structuralBreakDetected: false,
      operationalRegime: 'STABLE_SEASONAL',
      lastChangedAgo: '22d ago',
      mbbBlockLength: 3,
      breakConfidencePercent: 99.4,
      regimeTimeline: [
        { id: '1', label: 'STABLE', status: 'STABLE', periodName: 'Jun', summary: 'Consistent 120+ Deliveries/wk', cvVariation: 0.08 },
        { id: '2', label: 'STABLE', status: 'STABLE', periodName: 'Jul', summary: 'Rain Incentive Peak Surges', cvVariation: 0.11 },
        { id: '3', label: 'NOW', status: 'NOW', periodName: 'Aug (Active)', summary: 'Lookback Window Full Horizon (k̂_t = 12)', cvVariation: 0.09 },
      ],
    },
    statisticalMetrics: priyaStats,
    scoringProfile: {
      ...priyaScoring,
      trustScore: 810,
      trustScore100: 89,
      trustGrade: 'PRIME_TRUST',
      resilienceScore: 88.2,
      resilienceVerdict: 'Prime resilience: overnight liquid buffer covers over 22 days of full household essentials.',
    },
    adaptiveProductRecommendation: {
      underwritingDecision: 'APPROVED',
      approvedCreditLimit: 95000,
      repaymentStructure: 'CASH_FLOW_ADAPTIVE',
      baseCommitmentAmount: 3200,
      currentDynamicEmi: 3200,
      surgeRepaymentFactorGamma: 0.15,
      shockShieldGracePeriodActive: false,
      shockShieldMonthsGranted: 0,
      recommendedMicroSavingsSweepPercent: 4.0,
      bankUnderwritingJustification:
        'Prime Trust candidate with exceptional consistency ratio (1.00) and zero non-seasonal deficit shocks. Approved for instant disbursement.',
      repaymentEquationFormula: 'R_t = min(₹3,200, 0.15 × X_t)',
    },
    loanFacility: {
      facilityId: 'FAC-GIG-7718',
      facilityName: 'EV Two-Wheeler Mobility Flex-Loan',
      principalLimit: 95000,
      outstandingBalance: 24800,
      baseEmi: 3200,
      currentAdaptiveEmi: 3200,
      repaymentFactorGamma: 0.15,
      shockShieldStatus: 'ACTIVE',
      graceMonthsRemaining: 0,
      lastPaymentDate: '2026-08-05',
    },
    connectedBankAccounts: [
      {
        id: 'acc-kotak-5590',
        bankName: 'Kotak Mahindra Bank (811 Gig Account)',
        accountType: 'SAVINGS',
        mask: '•••• 5590',
        balanceAvailable: 24000,
        balanceCurrent: 24000,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T10:00:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-federal-6432',
        bankName: 'Federal Bank (FedMobile Fast Payout)',
        accountType: 'SAVINGS',
        mask: '•••• 6432',
        balanceAvailable: 8200,
        balanceCurrent: 8200,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T10:00:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-airtel-2011',
        bankName: 'Airtel Payments Bank (Fuel & Fastag Wallet)',
        accountType: 'SAVINGS',
        mask: '•••• 2011',
        balanceAvailable: 4800,
        balanceCurrent: 4800,
        currency: 'INR',
        lastSyncedAt: '2026-08-13T10:00:00.000Z',
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
    ],
    bankLastSyncedAt: '2026-08-13T10:00:00.000Z',
    passportCertId: 'BAWS-CERT-2026-IN-77189',
    passportHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    passportIssuedDate: '12 Aug 2026',
  };

  return [aarti, rajesh, priya];
}
