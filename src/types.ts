export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'github' | 'demo';
  accessToken?: string;
  role: 'borrower' | 'underwriter' | 'admin';
  linkedBorrowerId?: string;
  loginTimestamp: string;
}

export type SectorType =
  | 'AGRICULTURE_SMALLHOLDER'
  | 'INFORMAL_RETAIL'
  | 'GIG_WORKER'
  | 'SEASONAL_LABOR';

export type SeasonTag =
  | 'SOWING'
  | 'GROWTH'
  | 'HARVEST'
  | 'OFF_SEASON'
  | 'REGULAR';

export type OperationalRegime =
  | 'STABLE_SEASONAL'
  | 'EXOGENOUS_SHOCK'
  | 'RECOVERY_TRANSITION'
  | 'HIGH_VOLATILITY';

export type TrustGrade =
  | 'PRIME_TRUST'
  | 'GOOD_TRUST'
  | 'MODERATE_RISK'
  | 'HIGH_STRESS';

export type UnderwritingDecision =
  | 'APPROVED'
  | 'APPROVED_CONDITIONAL'
  | 'RESTRUCTURED_OFFER'
  | 'DECLINED';

export type RepaymentStructure =
  | 'CASH_FLOW_ADAPTIVE'
  | 'HARVEST_BULLET'
  | 'STANDARD_EMI';

export interface CashFlowRecord {
  periodIndex: number;
  periodDate: string;
  label?: string;
  grossInflow: number;
  grossOutflow: number;
  netCashFlow: number;
  seasonTag: SeasonTag;
  description?: string;
}

export interface RegimeTimelineStep {
  id: string;
  label: string;
  status: 'STABLE' | 'WATCH' | 'NOW' | 'SHOCK';
  periodName: string;
  summary: string;
  cvVariation: number;
}

export interface BawsEngineState {
  optimalLookbackWindowK: number; // in periods / weeks / months
  totalHistoryAvailable: number;
  structuralBreakDetected: boolean;
  breakReason?: string;
  operationalRegime: OperationalRegime;
  lastChangedAgo: string;
  regimeTimeline: RegimeTimelineStep[];
  mbbBlockLength: number; // l_i = c * ceil(i^(1/3))
  breakConfidencePercent: number;
}

export interface StatisticalMetrics {
  meanPositiveCashFlow: number;
  cashFlowVolatilitySigma: number;
  coefficientOfVariation: number;
  consistencyRatio: number;
  nonSeasonalShockFrequency: number;
  valueAtRisk90: number; // VaR_0.90
  expectedShortfall90: number; // ES_0.90
  pinballLoss?: number;
  fisslerZiegelLoss?: number;
  varDeltaPercent?: number; // e.g. +12%
}

export interface ResilienceFormulaDetails {
  liquidBuffer: number;
  expectedPositiveCashFlow: number;
  expectedShortfallDeficit: number;
  calculatedScore: number;
  essentialDaysCovered: number;
}

export interface ScoringProfile {
  trustScore: number; // 300 - 850
  trustScore100: number; // 0 - 100 for display
  trustGrade: TrustGrade;
  resilienceScore: number; // 0.0 - 100.0
  resilienceVerdict: string;
  formulaBreakdown: ResilienceFormulaDetails;
}

export interface AdaptiveProductRecommendation {
  underwritingDecision: UnderwritingDecision;
  approvedCreditLimit: number;
  repaymentStructure: RepaymentStructure;
  baseCommitmentAmount: number;
  currentDynamicEmi: number;
  surgeRepaymentFactorGamma: number; // default 0.15 - 0.20
  shockShieldGracePeriodActive: boolean;
  shockShieldMonthsGranted: number;
  recommendedMicroSavingsSweepPercent: number; // 2.0 - 5.0%
  bankUnderwritingJustification: string;
  repaymentEquationFormula: string;
}

export interface ActionItem {
  id: string;
  category: 'DO THIS NOW' | 'DO THIS SOON' | 'CONSIDER' | 'ACTIVE_SHIELD';
  badgeType: 'RECOMMENDED' | 'PENDING' | 'CONSIDER' | 'SHOCK_SHIELD';
  stepNumber: string; // "01 / 03"
  title: string;
  description: string;
  impactText: string;
  whyExplanation: string;
  actionType: 'PROTECT_BUFFER' | 'REPAY_FLEXIBLE' | 'SWEEP_RESERVE' | 'ACTIVATE_SHIELD';
  amount: number;
  status: 'TODO' | 'COMPLETED';
  completedTimestamp?: string;
}

export interface LoanFacility {
  facilityId: string;
  facilityName: string;
  principalLimit: number;
  outstandingBalance: number;
  baseEmi: number;
  currentAdaptiveEmi: number;
  repaymentFactorGamma: number;
  shockShieldStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'CLOSED' | 'RESTRUCTURED';
  graceMonthsRemaining: number;
  lastPaymentDate: string;
}

export interface BufferHistoryPoint {
  month: string; // e.g. 'Mar 2026'
  shortMonth: string; // 'Mar'
  baseBuffer: number; // core reserves without micro-sweeps
  microSavingsSweep: number; // cumulative micro-savings swept into buffer
  totalBuffer: number; // baseBuffer + microSavingsSweep
  sweepThisMonth: number; // incremental sweep in this month
  essentialDaysCovered: number;
  milestoneTarget: number;
  notes?: string;
}

export interface BankConnectedAccount {
  id: string;
  bankName: string;
  accountType: 'SAVINGS' | 'CHECKING' | 'CURRENT' | 'OD_CC';
  mask: string;
  balanceAvailable: number;
  balanceCurrent: number;
  currency: string;
  institutionLogo?: string;
  lastSyncedAt: string;
  provider: 'PLAID' | 'ACCOUNT_AGGREGATOR' | 'OPEN_BANKING';
  status: 'ACTIVE' | 'REQUIRES_REAUTH' | 'SYNCING';
}

export interface BankSyncResult {
  success: boolean;
  syncedRecordsCount: number;
  totalTransactionsParsed: number;
  liveBufferAmount: number;
  accounts: BankConnectedAccount[];
  lastSyncIso: string;
  provider: string;
  message: string;
}

export interface BankProviderConfig {
  isPlaidConfigured: boolean;
  isAAConfigured: boolean;
  plaidEnv: string;
  connectedAccounts: BankConnectedAccount[];
  autoSyncEnabled: boolean;
}

export interface BorrowerProfile {
  borrowerId: string;
  phoneNumber: string;
  fullName: string;
  displayName: string;
  greetingDate: string;
  sectorType: SectorType;
  sectorLabel: string;
  currency: string;
  currencySymbol: string;
  currentLiquidBuffer: number;
  safeToSpendDaily: number;
  requestedFacilityAmount: number;
  pressureStatusBanner: {
    isUnderPressure: boolean;
    title: string;
    description: string;
    severity: 'warning' | 'alert' | 'healthy';
  };
  cashFlowRecords: CashFlowRecord[];
  bufferHistory?: BufferHistoryPoint[];
  connectedBankAccounts?: BankConnectedAccount[];
  bankLastSyncedAt?: string;
  bawsEngineState: BawsEngineState;
  statisticalMetrics: StatisticalMetrics;
  scoringProfile: ScoringProfile;
  adaptiveProductRecommendation: AdaptiveProductRecommendation;
  loanFacility: LoanFacility;
  actions: ActionItem[];
  passportCertId: string;
  passportHash: string;
  passportIssuedDate: string;
}
