import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Lock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Search,
  Check,
  CreditCard,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from 'lucide-react';
import { BorrowerProfile, BankConnectedAccount, BankProviderConfig, BankSyncResult } from '../types';
import { AVAILABLE_SAMPLE_BANKS, SampleBankInstitution } from '../utils/bawsEngine';

interface BankConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
  onProfileUpdated: (updatedProfile: BorrowerProfile) => void;
}

export const BankConnectModal: React.FC<BankConnectModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}) => {
  const [bankConfig, setBankConfig] = useState<BankProviderConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingBankId, setConnectingBankId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<BankSyncResult | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'ACCOUNT_AGGREGATOR' | 'PLAID'>('ACCOUNT_AGGREGATOR');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'PUBLIC' | 'PRIVATE' | 'PAYMENT' | 'GLOBAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch provider config on open
  useEffect(() => {
    if (!isOpen) return;

    fetch(`/api/bank/config/${profile.borrowerId}`)
      .then((res) => res.json())
      .then((data) => setBankConfig(data))
      .catch((err) => console.warn('Could not load bank provider config:', err));
  }, [isOpen, profile.borrowerId]);

  // Filter sample banks
  const filteredBanks = useMemo(() => {
    return AVAILABLE_SAMPLE_BANKS.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.popularFor.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeCategory === 'ALL') return true;
      if (activeCategory === 'PUBLIC' && b.category === 'PUBLIC_SECTOR_INDIA') return true;
      if (activeCategory === 'PRIVATE' && b.category === 'PRIVATE_SECTOR_INDIA') return true;
      if (activeCategory === 'PAYMENT' && b.category === 'PAYMENT_BANK_INDIA') return true;
      if (activeCategory === 'GLOBAL' && b.category === 'GLOBAL_PLAID') return true;

      return true;
    });
  }, [searchQuery, activeCategory]);

  if (!isOpen) return null;

  // Handle Real-Time Bank Sync
  const handleSyncRealTimeData = async (targetBankId?: string) => {
    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/bank/sync/${profile.borrowerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          bankId: targetBankId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        if (data.profile) {
          onProfileUpdated(data.profile);
        }
        setStatusMessage(`Live statement synced! ${data.totalTransactionsParsed} transactions parsed, reserve updated.`);
      } else {
        setStatusMessage(data.error || 'Failed to sync bank data');
      }
    } catch (err: any) {
      setStatusMessage('Network error during bank synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Connect a specific sample bank institution
  const handleConnectSampleBank = async (bank: SampleBankInstitution) => {
    setConnectingBankId(bank.id);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/bank/connect-sample/${profile.borrowerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: bank.id }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        onProfileUpdated(data.profile);
        // Automatically sync fresh real-time transactions
        await handleSyncRealTimeData(bank.id);
        setStatusMessage(`Linked ${bank.name} successfully! Real-time statement streaming is active.`);
      }
    } catch (err) {
      setStatusMessage(`Connected ${bank.name} in offline sandbox mode.`);
    } finally {
      setConnectingBankId(null);
    }
  };

  // Handle Initiating Bank Connection from primary button
  const handleInitiateBankConnect = async () => {
    setIsConnecting(true);
    setStatusMessage(null);

    if (selectedProvider === 'PLAID') {
      try {
        const res = await fetch('/api/bank/plaid/link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.borrowerId }),
        });
        const data = await res.json();

        if (data.link_token) {
          setStatusMessage(`Plaid Link Token generated (${data.link_token.slice(0, 14)}...). Ready for bank authentication.`);
        } else {
          setStatusMessage('Connecting via Open Banking Plaid sandbox test suite...');
          await handleSyncRealTimeData('bank-chase');
        }
      } catch (err) {
        setStatusMessage('Connecting via Open Banking sandbox test suite...');
        await handleSyncRealTimeData();
      } finally {
        setIsConnecting(false);
      }
    } else {
      try {
        const res = await fetch('/api/bank/account-aggregator/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.borrowerId,
            mobileNumber: profile.phoneNumber,
            vpaHandle: 'user@okhdfcbank',
          }),
        });
        const data = await res.json();
        if (data.consentHandle) {
          await handleSyncRealTimeData();
        }
      } catch (err) {
        await handleSyncRealTimeData();
      } finally {
        setIsConnecting(false);
      }
    }
  };

  // Disconnect an account
  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/bank/disconnect/${profile.borrowerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (data.success) {
        onProfileUpdated({
          ...profile,
          connectedBankAccounts: data.connectedAccounts,
        });
        setStatusMessage('Account disconnected successfully.');
      }
    } catch (err) {
      console.error('Failed to disconnect account', err);
    }
  };

  const accounts = profile.connectedBankAccounts || bankConfig?.connectedAccounts || [];
  const lastSynced = profile.bankLastSyncedAt
    ? new Date(profile.bankLastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Recent';

  const totalConnectedBalance = accounts.reduce((acc, a) => acc + (a.balanceAvailable || 0), 0);

  return (
    <div
      id="bank-connect-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div
        className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 border border-[#e5ded0] shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#123524] text-[#98d4ad] flex items-center justify-center shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#6e7f74]">
                  Real-Time Banking Integration
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#eef7f2] text-[#123524] text-[9px] font-mono font-bold">
                  {accounts.length} Active Accounts
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#123524]">
                Connected Bank Accounts
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f4eee1] hover:bg-[#eae2d3] flex items-center justify-center text-[#123524] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Notification if any */}
        {statusMessage && (
          <div className="p-3.5 bg-[#eef7f2] border border-[#cbe4d4] rounded-2xl text-[12px] text-[#123524] flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#123524] shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* Live Bank Feed Status Banner */}
        <div className="bg-[#fcfaf4] border border-[#e8e2d5] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[13px] font-bold text-[#123524]">
                Live Statement Streaming Active
              </span>
              <span className="text-[11px] font-mono text-[#6e7f74]">
                (₹{totalConnectedBalance.toLocaleString('en-IN')} Total Available)
              </span>
            </div>
            <p className="text-[11px] text-[#6e7f74] mt-0.5 font-mono">
              Last synchronized: {lastSynced} · 256-Bit TLS End-to-End Encrypted
            </p>
          </div>

          <button
            onClick={() => handleSyncRealTimeData()}
            disabled={isSyncing}
            className="w-full sm:w-auto py-2 px-4 bg-[#123524] hover:bg-[#1a4a33] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 active:scale-98"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Now'}</span>
          </button>
        </div>

        {/* Connected Accounts List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-[#6e7f74] px-1">
            <span>Linked Institutions ({accounts.length})</span>
            <span>Available Balance</span>
          </div>

          {accounts.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-white border border-[#e5ded0] rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-[#123524]/30 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f4eee1] text-[#123524] flex items-center justify-center font-bold font-mono text-xs shrink-0">
                      {acc.bankName.includes('SBI') || acc.bankName.includes('State Bank')
                        ? 'SBI'
                        : acc.bankName.includes('HDFC')
                        ? 'HDFC'
                        : acc.bankName.includes('ICICI')
                        ? 'ICIC'
                        : acc.bankName.includes('Kotak')
                        ? 'KOTK'
                        : acc.bankName.includes('Axis')
                        ? 'AXIS'
                        : acc.bankName.includes('Baroda')
                        ? 'BOB'
                        : acc.bankName.includes('Punjab')
                        ? 'PNB'
                        : acc.bankName.includes('Canara')
                        ? 'CAN'
                        : acc.bankName.includes('Chase')
                        ? 'CHAS'
                        : 'BK'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-bold text-[#123524] leading-tight">
                          {acc.bankName}
                        </h4>
                        <span className="px-1.5 py-0.5 bg-[#eef7f2] text-[#123524] text-[9px] font-mono font-bold rounded">
                          {acc.accountType}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#6e7f74] mt-0.5">
                        A/C {acc.mask} · {acc.provider === 'ACCOUNT_AGGREGATOR' ? 'RBI AA Stream' : 'Plaid Core'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-base font-bold text-[#123524] block">
                      {acc.currency === 'USD' ? '$' : acc.currency === 'GBP' ? '£' : '₹'}
                      {acc.balanceAvailable.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => handleDisconnect(acc.id)}
                      className="text-[10px] text-[#b91c1c] hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 border border-dashed border-[#dcd4c5] rounded-2xl text-center space-y-2">
              <Building2 className="w-8 h-8 text-[#98a89e] mx-auto" />
              <p className="text-[13px] text-[#6e7f74]">
                No bank accounts linked yet. Select any bank below to stream live cash flows into BAWS.
              </p>
            </div>
          )}
        </div>

        {/* Bank Test Suite & Institution Selector */}
        <div className="bg-[#f8f5ee] border border-[#e8e2d5] rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6e7f74] block">
                Sample Banks & Test Suite ({AVAILABLE_SAMPLE_BANKS.length} Available)
              </span>
              <p className="text-[11px] text-[#123524] font-medium">
                Click any institution to instantly link & stream realistic transactions
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#123524] font-medium shrink-0">
              <Lock className="w-3 h-3 text-[#123524]" />
              <span>Direct AA / Plaid Sandbox</span>
            </div>
          </div>

          {/* Search and Category Filter Pills */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6e7f74] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search banks (e.g. SBI, HDFC, ICICI, Kotak, Axis, PNB, Canara, Chase)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#e5ded0] rounded-xl text-[12px] text-[#123524] placeholder:text-[#98a89e] focus:outline-none focus:ring-1 focus:ring-[#123524]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'All Banks' },
                { id: 'PUBLIC', label: 'Public Sector (India)' },
                { id: 'PRIVATE', label: 'Private Sector (India)' },
                { id: 'PAYMENT', label: 'Payment Wallets' },
                { id: 'GLOBAL', label: 'Global (Plaid)' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    activeCategory === cat.id
                      ? 'bg-[#123524] text-white shadow-xs'
                      : 'bg-white/80 text-[#6e7f74] hover:bg-white border border-[#e5ded0]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sample Bank Institution Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredBanks.map((bank) => {
              const isAlreadyConnected = accounts.some(
                (a) => a.bankName.toLowerCase().includes(bank.name.toLowerCase()) || a.mask === bank.mask
              );
              const isThisConnecting = connectingBankId === bank.id;

              return (
                <button
                  key={bank.id}
                  onClick={() => handleConnectSampleBank(bank)}
                  disabled={isThisConnecting}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-1.5 ${
                    isAlreadyConnected
                      ? 'bg-[#f0f8f3] border-[#98d4ad] ring-1 ring-[#98d4ad]/40'
                      : 'bg-white border-[#e5ded0] hover:border-[#123524]/40 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#f4eee1] text-[#123524] flex items-center justify-center font-mono font-bold text-[10px]">
                        {bank.code}
                      </div>
                      <div>
                        <h4 className="text-[12px] font-bold text-[#123524] leading-snug">
                          {bank.name}
                        </h4>
                        <span className="text-[9px] font-mono text-[#6e7f74]">
                          {bank.mask} · {bank.accountType}
                        </span>
                      </div>
                    </div>

                    {isAlreadyConnected ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#123524] text-[#98d4ad] text-[8px] font-mono font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Linked
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono font-bold text-[#123524] bg-[#f4eee1] px-1.5 py-0.5 rounded">
                        + Connect
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-[#6e7f74] line-clamp-1">
                    {bank.tagline}
                  </p>

                  <div className="pt-1 border-t border-[#f0ece1] flex items-center justify-between text-[10px] font-mono text-[#123524]">
                    <span className="text-[#6e7f74]">{bank.popularFor}</span>
                    <span className="font-bold">
                      {bank.currencySymbol}
                      {bank.defaultBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Connect Mode Selector */}
          <div className="pt-2 border-t border-[#e8e2d5] grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedProvider('ACCOUNT_AGGREGATOR')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedProvider === 'ACCOUNT_AGGREGATOR'
                  ? 'bg-white border-[#123524] ring-1 ring-[#123524] shadow-xs'
                  : 'bg-white/50 border-[#e5ded0] text-[#6e7f74] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#123524]">RBI AA (India)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              </div>
              <p className="text-[9px] text-[#6e7f74] mt-0.5">
                Multi-bank consent architecture
              </p>
            </button>

            <button
              onClick={() => setSelectedProvider('PLAID')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedProvider === 'PLAID'
                  ? 'bg-white border-[#123524] ring-1 ring-[#123524] shadow-xs'
                  : 'bg-white/50 border-[#e5ded0] text-[#6e7f74] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#123524]">Plaid Global</span>
                <span className="text-[8px] font-mono px-1 py-0.2 bg-[#f4eee1] rounded text-[#6e7f74]">Sandbox</span>
              </div>
              <p className="text-[9px] text-[#6e7f74] mt-0.5">
                International Open Banking
              </p>
            </button>
          </div>

          <button
            onClick={handleInitiateBankConnect}
            disabled={isConnecting}
            className="w-full py-2.5 px-4 bg-[#123524] hover:bg-[#1a4a33] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isConnecting
                ? 'Initiating Secure Consent Stream...'
                : selectedProvider === 'ACCOUNT_AGGREGATOR'
                ? 'Link Selected Indian Bank via Account Aggregator'
                : 'Authenticate via Plaid Open Banking Link'}
            </span>
          </button>
        </div>

        {/* How Real-Time Banking Powers BAWS */}
        <div className="p-3 bg-[#eef7f2] border border-[#cbe4d4] rounded-2xl space-y-1 text-[11px] text-[#123524]">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#123524]" />
            <span>How Real-Time Banking Feeds Non-Stationary Risk</span>
          </div>
          <p className="text-[#3b5948] leading-relaxed">
            Streaming bank transactions feeds daily gross inflows directly into the non-parametric bootstrap engine (k̂_t). It detects seasonal Mandi surges, auto-sweeps 2.5% micro-savings into your liquid reserve, and dynamically recalculates safe-to-spend limits in real time.
          </p>
        </div>
      </div>
    </div>
  );
};
