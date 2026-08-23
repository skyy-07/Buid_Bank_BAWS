import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  getInitialAartiProfile,
  getAvailableArchetypes,
  computeTailRiskMetrics,
  calculateBawsScores,
} from './src/utils/bawsEngine';
import { BorrowerProfile, CashFlowRecord } from './src/types';
import {
  getBankProviderConfig,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  initiateAccountAggregatorConsent,
  syncRealTimeBankData,
  getAvailableSampleBanks,
  connectSampleBankToProfile,
} from './server/bankApi';
import {
  getOAuthAuthUrl,
  exchangeOAuthCode,
  createDemoOAuthSession,
} from './server/oauthApi';
import {
  initProfiles,
  getProfile,
  setProfile,
  getProfilesStore,
  initSessions,
  getSession,
  setSession,
  deleteSession,
  getAllSessions,
  getSessionsStore,
  initTokens,
  flushToDisk,
  startPeriodicFlush,
} from './server/persist';
import { executeBuildingTheBankModel } from './server/bawsModelBridge';

// Initialize persistent stores with seed data
initProfiles(getAvailableArchetypes());
initSessions({
  'demo-borrower-session': {
    id: 'user_aarti_patel',
    email: 'demo@baws-platform.example',
    name: 'Aarti Patel (Farmer / Borrower)',
    picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    provider: 'demo',
    role: 'borrower',
    linkedBorrowerId: 'baws-user-aarti-8821',
    loginTimestamp: new Date().toISOString(),
  },
});
initTokens();
flushToDisk();


async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // CORS middleware (#22)
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [process.env.APP_URL, `http://localhost:${PORT}`, `http://localhost:5173`].filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.some(o => o && origin.startsWith(o))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Session-based auth middleware for protected routes (#10)
  // Public routes: health, auth/*, borrowers list, sample-banks, static assets
  const publicPaths = ['/api/health', '/api/auth/', '/auth/callback', '/api/bank/sample-banks'];

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    // Skip auth for public paths
    if (publicPaths.some(p => req.path.startsWith(p))) return next();
    // Skip auth for GET on borrower list (read-only)
    if (req.method === 'GET' && req.path === '/api/borrowers') return next();

    const authHeader = req.headers.authorization;
    const sessionId = authHeader?.replace(/^Bearer\s+/i, '') || (req.query.sessionId as string);

    if (sessionId && getSession(sessionId)) {
      return next();
    }

    // Allow if any session exists (demo mode fallback)
    if (getAllSessions().length > 0) {
      return next();
    }

    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  // Apply auth middleware to /api/* routes
  app.use('/api/borrowers/:id', requireAuth);
  app.use('/api/bank', requireAuth);

  // Lazy Gemini client helper
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!aiClient && process.env.GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // 1. Health check & Readiness probe (#18)
  app.get('/api/health', (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const distExists = isProd ? fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')) : true;
    
    if (isProd && !distExists) {
      return res.status(503).json({
        status: 'initializing',
        ready: false,
        timestamp: new Date().toISOString(),
        message: 'Static asset bundle is building or missing',
      });
    }

    res.json({
      status: 'ok',
      ready: true,
      env: process.env.NODE_ENV || 'development',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // --- OAuth 2.0 Authentication Routes ---
  // Render injects RENDER_EXTERNAL_HOSTNAME automatically; APP_URL can be set manually for custom domains
  const currentAppUrl = process.env.APP_URL
    || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '')
    || `http://localhost:${PORT}`;

  // 1a. OAuth Status & Config
  app.get('/api/auth/config', (req, res) => {
    const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);
    const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID);
    res.json({
      google: {
        configured: googleConfigured,
        clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 10)}...` : null,
      },
      github: {
        configured: githubConfigured,
        clientId: process.env.GITHUB_CLIENT_ID ? `${process.env.GITHUB_CLIENT_ID.slice(0, 10)}...` : null,
      },
      callbackUrl: `${currentAppUrl.replace(/\/$/, '')}/auth/callback`,
      appUrl: currentAppUrl,
    });
  });

  // 1b. Get OAuth Authorization Provider URL (for popup window)
  app.get('/api/auth/url', (req, res) => {
    const provider = (req.query.provider as 'google' | 'github') || 'google';
    const state = (req.query.state as string) || `provider=${provider}`;
    const result = getOAuthAuthUrl(provider, currentAppUrl, state);
    res.json(result);
  });

  // 1c. One-Click Demo / Sandbox Session Creator
  app.post('/api/auth/demo-login', (req, res) => {
    const { role, email, name } = req.body;
    const sessionUser = createDemoOAuthSession(role || 'borrower', email, name);
    res.json({
      success: true,
      user: sessionUser,
      message: `Signed in as ${sessionUser.name} (${sessionUser.role})`,
    });
  });

  // 1d. Get current logged in session
  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    const sessionId = authHeader?.replace(/^Bearer\s+/i, '') || req.query.sessionId as string;

    const sessionUser = sessionId ? getSession(sessionId) : undefined;
    if (sessionUser) {
      return res.json({ authenticated: true, user: sessionUser });
    }

    // Default to latest active session
    const sessions = getAllSessions();
    if (sessions.length > 0) {
      return res.json({ authenticated: true, user: sessions[sessions.length - 1] });
    }

    res.json({ authenticated: false, user: null });
  });

  // 1e. Sign out
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const sessionId = authHeader?.replace(/^Bearer\s+/i, '') || req.body.sessionId;
    if (sessionId && getSession(sessionId)) {
      deleteSession(sessionId);
      flushToDisk();
    }
    res.json({ success: true });
  });

  // 1f. OAuth Callback Route (popup postMessage handler)
  // HTML-escape helper to prevent XSS (#8)
  const escapeHtml = (str: string) =>
    String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code, state, error, error_description } = req.query;
    // Determine the safe origin for postMessage (#9)
    const safeOrigin = currentAppUrl || '*';

    if (error) {
      const safeError = escapeHtml(String(error));
      const safeDesc = escapeHtml(String(error_description || error));
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: sans-serif; padding: 24px; text-align: center;">
            <h3 style="color: #b91c1c;">OAuth Authentication Failed</h3>
            <p>${safeDesc}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(String(error))} }, ${JSON.stringify(safeOrigin)});
                setTimeout(() => window.close(), 2500);
              }
            </script>
          </body>
        </html>
      `);
    }

    const stateStr = (state as string) || '';
    const isGithub = stateStr.includes('provider=github');
    const provider = isGithub ? 'github' : 'google';

    let userJson = '{}';
    let errorMessage = '';

    if (code) {
      try {
        const user = await exchangeOAuthCode(code as string, provider, currentAppUrl);
        userJson = JSON.stringify(user);
      } catch (err: any) {
        console.error('OAuth exchange error:', err.message);
        errorMessage = err.message || 'Failed to exchange OAuth code';
      }
    }

    const safeErrorMessage = escapeHtml(errorMessage);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fdfbf7; color: #123524; }
            .card { background: white; border: 1px solid #e8e2d5; border-radius: 16px; padding: 28px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 360px; }
            .spinner { width: 32px; height: 32px; border: 3px solid #e5ded0; border-top-color: #123524; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            ${
              errorMessage
                ? `<h3 style="color: #dc2626; margin: 0 0 8px;">Login Encountered an Error</h3><p style="font-size: 13px; color: #666;">${safeErrorMessage}</p>`
                : `<div class="spinner"></div><h3 style="margin: 0 0 8px;">Authenticating BAWS</h3><p style="font-size: 13px; color: #55695c;">Transferring verified OAuth credentials...</p>`
            }
          </div>
          <script>
            (function() {
              var payload = {
                type: ${JSON.stringify(errorMessage ? 'OAUTH_AUTH_ERROR' : 'OAUTH_AUTH_SUCCESS')},
                user: ${userJson},
                error: ${JSON.stringify(errorMessage)}
              };
              if (window.opener) {
                window.opener.postMessage(payload, ${JSON.stringify(safeOrigin)});
                setTimeout(function() { window.close(); }, 800);
              } else {
                window.location.href = '/';
              }
            })();
          </script>
        </body>
      </html>
    `);
  });

  // 2. List all borrowers
  app.get('/api/borrowers', (req, res) => {
    const list = Object.values(getProfilesStore()).map((p) => ({
      borrowerId: p.borrowerId,
      fullName: p.fullName,
      displayName: p.displayName,
      sectorType: p.sectorType,
      sectorLabel: p.sectorLabel,
      trustScore: p.scoringProfile.trustScore,
      trustScore100: p.scoringProfile.trustScore100,
      resilienceScore: p.scoringProfile.resilienceScore,
      currentLiquidBuffer: p.currentLiquidBuffer,
      operationalRegime: p.bawsEngineState.operationalRegime,
      structuralBreakDetected: p.bawsEngineState.structuralBreakDetected,
      underwritingDecision: p.adaptiveProductRecommendation.underwritingDecision,
    }));
    res.json(list);
  });

  // 3. Get single borrower detail
  app.get('/api/borrowers/:id', (req, res) => {
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }
    res.json(profile);
  });

  // 4. Perform an action (e.g. Protect buffer, Repay flexible EMI, Sweep reserve, Shock Shield)
  app.post('/api/borrowers/:id/action', (req, res) => {
    const { actionId, actionType, amount } = req.body;
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    const action = profile.actions.find((a) => a.id === actionId);
    if (action) {
      action.status = 'COMPLETED';
      action.completedTimestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    if (actionType === 'PROTECT_BUFFER') {
      const protAmt = amount || 6000;
      profile.currentLiquidBuffer += protAmt;
      profile.scoringProfile.resilienceScore = Math.min(100, Number((profile.scoringProfile.resilienceScore + 6.0).toFixed(1)));
      profile.pressureStatusBanner.isUnderPressure = false;
      profile.pressureStatusBanner.title = 'Buffer Protected · Resilience Boosted';
      profile.pressureStatusBanner.description = `₹${protAmt.toLocaleString('en-IN')} locked safely in overnight liquid reserve. Essential obligations shielded.`;
      profile.pressureStatusBanner.severity = 'healthy';
      if (profile.bufferHistory && profile.bufferHistory.length > 0) {
        const last = profile.bufferHistory[profile.bufferHistory.length - 1];
        last.baseBuffer += protAmt;
        last.totalBuffer += protAmt;
      }
    } else if (actionType === 'REPAY_FLEXIBLE') {
      const repayAmt = amount || 1850;
      profile.loanFacility.outstandingBalance = Math.max(0, profile.loanFacility.outstandingBalance - repayAmt);
      profile.loanFacility.lastPaymentDate = new Date().toISOString().split('T')[0];
      profile.scoringProfile.trustScore = Math.min(850, profile.scoringProfile.trustScore + 8);
      profile.scoringProfile.trustScore100 = Math.min(100, profile.scoringProfile.trustScore100 + 1);
    } else if (actionType === 'SWEEP_RESERVE') {
      const sweepAmt = amount || 430;
      profile.currentLiquidBuffer += sweepAmt;
      profile.scoringProfile.resilienceScore = Math.min(100, Number((profile.scoringProfile.resilienceScore + 0.8).toFixed(1)));
      if (profile.bufferHistory && profile.bufferHistory.length > 0) {
        const last = profile.bufferHistory[profile.bufferHistory.length - 1];
        last.microSavingsSweep += sweepAmt;
        last.totalBuffer += sweepAmt;
        last.sweepThisMonth += sweepAmt;
      }
    } else if (actionType === 'ACTIVATE_SHIELD') {
      profile.loanFacility.shockShieldStatus = 'GRACE_PERIOD';
      profile.loanFacility.graceMonthsRemaining = 2;
      profile.loanFacility.currentAdaptiveEmi = 0;
      profile.adaptiveProductRecommendation.shockShieldGracePeriodActive = true;
      profile.adaptiveProductRecommendation.shockShieldMonthsGranted = 2;
      profile.bawsEngineState.operationalRegime = 'EXOGENOUS_SHOCK';
    }

    setProfile(profile.borrowerId, profile);
    flushToDisk();
    res.json({ success: true, profile });
  });

  // 4b. Real-Time Bank Information API Endpoints
  app.get('/api/bank/config/:id', (req, res) => {
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }
    const config = getBankProviderConfig(profile);
    res.json(config);
  });

  // Get All Available Sample Banks Catalog
  app.get('/api/bank/sample-banks', (req, res) => {
    const banks = getAvailableSampleBanks();
    res.json({ success: true, banks });
  });

  // Connect a Specific Sample Bank Institution to Profile
  app.post('/api/bank/connect-sample/:id', (req, res) => {
    const { bankId } = req.body;
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    const result = connectSampleBankToProfile(profile, bankId || 'bank-sbi');
    res.json({ success: true, account: result.account, profile: result.profile });
  });

  // Create Plaid Link Token
  app.post('/api/bank/plaid/link-token', async (req, res) => {
    const { userId } = req.body;
    try {
      const linkData = await createPlaidLinkToken(userId || 'baws-user-aarti-8821', process.env.APP_URL);
      res.json(linkData);
    } catch (err: any) {
      console.warn('Plaid link token generation status:', err.message);
      res.status(503).json({
        error: err.message || 'Plaid API credentials required',
        isConfigured: false,
      });
    }
  });

  // Exchange Plaid Public Token
  app.post('/api/bank/plaid/exchange-token', async (req, res) => {
    const { userId, publicToken } = req.body;
    const profile = getProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    try {
      const result = await exchangePlaidPublicToken(profile.borrowerId, publicToken, profile);
      res.json(result);
    } catch (err: any) {
      console.error('Plaid token exchange error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Initiate Account Aggregator (AA) Consent for Indian Banks
  app.post('/api/bank/account-aggregator/initiate', async (req, res) => {
    const { userId, mobileNumber, vpaHandle } = req.body;
    const profile = getProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    try {
      const consentResult = await initiateAccountAggregatorConsent(
        profile.borrowerId,
        mobileNumber || profile.phoneNumber,
        vpaHandle || 'user@upi'
      );
      res.json(consentResult);
    } catch (err: any) {
      console.error('AA consent error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Sync Real-Time Bank Information (Plaid or Account Aggregator live feed)
  app.post('/api/bank/sync/:id', async (req, res) => {
    const { provider, bankId } = req.body;
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    try {
      const syncResult = await syncRealTimeBankData(profile.borrowerId, profile, provider, bankId);
      res.json({
        ...syncResult,
        profile,
      });
    } catch (err: any) {
      console.error('Bank sync error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to sync real-time bank information' });
    }
  });

  // Disconnect Bank Account
  app.post('/api/bank/disconnect/:id', (req, res) => {
    const { accountId } = req.body;
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    if (profile.connectedBankAccounts) {
      profile.connectedBankAccounts = profile.connectedBankAccounts.filter((a) => a.id !== accountId);
    }

    res.json({ success: true, connectedAccounts: profile.connectedBankAccounts || [] });
  });

  // 5. Evaluate / Re-underwrite via Gemini AI Studio Bridge + Building The Bank Model
  app.post('/api/borrowers/:id/evaluate', async (req, res) => {
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    // Step 1: Execute the "Building The Bank" BAWS-NN Risk Engine
    let bawsModelResult;
    try {
      bawsModelResult = await executeBuildingTheBankModel(profile);
    } catch (e) {
      console.warn('[BAWS Evaluation] Building The Bank model notice:', e);
    }

    const ai = getGeminiClient();
    let geminiResponse: any = null;

    if (ai) {
      try {
        const payload = {
          borrowerId: profile.borrowerId,
          sectorType: profile.sectorType,
          currency: profile.currency,
          seriesLength: profile.cashFlowRecords.length,
          currentLiquidBuffer: profile.currentLiquidBuffer,
          requestedFacilityAmount: profile.requestedFacilityAmount,
          cashFlowRecords: profile.cashFlowRecords.map((r) => ({
            periodIndex: r.periodIndex,
            periodDate: r.periodDate,
            grossInflow: r.grossInflow,
            grossOutflow: r.grossOutflow,
            seasonTag: r.seasonTag,
          })),
          buildingTheBankModelCalculations: bawsModelResult ? {
            engineSource: bawsModelResult.engineSource,
            optimalLookbackMonths: bawsModelResult.bawsMetadata.optimalLookbackMonths,
            structuralBreakDetected: bawsModelResult.bawsMetadata.structuralBreakDetected,
            mbbBlockLength: bawsModelResult.bawsMetadata.mbbBlockLength,
            valueAtRisk90: bawsModelResult.riskMetrics.valueAtRisk90,
            expectedShortfall90: bawsModelResult.riskMetrics.expectedShortfall90,
            fisslerZiegelLoss: bawsModelResult.riskMetrics.fisslerZiegelLoss,
            modelTrustScore: bawsModelResult.riskMetrics.trustScore,
            modelResilienceScore: bawsModelResult.riskMetrics.resilienceScore,
            modelUnderwritingDecision: bawsModelResult.adaptiveProductTerms.underwritingDecision,
            recommendedCreditLimit: bawsModelResult.adaptiveProductTerms.creditFacilityLimit,
            surgeRepaymentFactorGamma: bawsModelResult.adaptiveProductTerms.surgeRepaymentFactorGamma,
          } : null,
        };

        const systemInstruction = `You are the BAWS (Bootstrap-Based Adaptive Window Selection) Financial Risk & Underwriting Engine.
Your purpose is to evaluate creditworthiness, estimate downside tail risk, and generate adaptive financial products for "credit-invisible" individuals with non-stationary, irregular, and stochastic income streams.
You are provided with quantitative model calculations from the "Building The Bank" BAWS-NN Engine. Use these metrics as ground truth inputs. The Gemini API has the final say as to the output.
Follow the Master Specification directives:
- Isolate routine seasonal cycles from true structural regime shifts.
- Under structural shocks, contract lookback k̂_t to isolate post-break reality.
- Estimate VaR_0.90 & ES_0.90 via pinball and Fissler-Ziegel losses.
- Compute Trust Score T_score ∈ [300, 850] and Resilience Score R_score ∈ [0, 100].
- Implement Zero-Default Policy: Dynamic flexible debt servicing R_t = min(EMI_base, γ * max(0, X_t)) and Automated Shock Shielding.`;

        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const modelName of modelsToTry) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: JSON.stringify(payload),
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1,
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    borrowerId: { type: Type.STRING },
                    evaluationTimestamp: { type: Type.STRING },
                    bawsEngineState: {
                      type: Type.OBJECT,
                      properties: {
                        optimalLookbackWindowK: { type: Type.INTEGER },
                        structuralBreakDetected: { type: Type.BOOLEAN },
                        breakReason: { type: Type.STRING },
                        operationalRegime: {
                          type: Type.STRING,
                          enum: ['STABLE_SEASONAL', 'EXOGENOUS_SHOCK', 'RECOVERY_TRANSITION', 'HIGH_VOLATILITY'],
                        },
                      },
                      required: ['optimalLookbackWindowK', 'structuralBreakDetected', 'operationalRegime'],
                    },
                    statisticalMetrics: {
                      type: Type.OBJECT,
                      properties: {
                        meanPositiveCashFlow: { type: Type.NUMBER },
                        cashFlowVolatilitySigma: { type: Type.NUMBER },
                        coefficientOfVariation: { type: Type.NUMBER },
                        consistencyRatio: { type: Type.NUMBER },
                        nonSeasonalShockFrequency: { type: Type.NUMBER },
                        valueAtRisk90: { type: Type.NUMBER },
                        expectedShortfall90: { type: Type.NUMBER },
                      },
                      required: ['meanPositiveCashFlow', 'coefficientOfVariation', 'consistencyRatio', 'valueAtRisk90', 'expectedShortfall90'],
                    },
                    scoringProfile: {
                      type: Type.OBJECT,
                      properties: {
                        trustScore: { type: Type.INTEGER },
                        trustGrade: {
                          type: Type.STRING,
                          enum: ['PRIME_TRUST', 'GOOD_TRUST', 'MODERATE_RISK', 'HIGH_STRESS'],
                        },
                        resilienceScore: { type: Type.NUMBER },
                        resilienceVerdict: { type: Type.STRING },
                      },
                      required: ['trustScore', 'trustGrade', 'resilienceScore', 'resilienceVerdict'],
                    },
                    adaptiveProductRecommendation: {
                      type: Type.OBJECT,
                      properties: {
                        underwritingDecision: {
                          type: Type.STRING,
                          enum: ['APPROVED', 'APPROVED_CONDITIONAL', 'RESTRUCTURED_OFFER', 'DECLINED'],
                        },
                        approvedCreditLimit: { type: Type.NUMBER },
                        repaymentStructure: {
                          type: Type.STRING,
                          enum: ['CASH_FLOW_ADAPTIVE', 'HARVEST_BULLET', 'STANDARD_EMI'],
                        },
                        baseCommitmentAmount: { type: Type.NUMBER },
                        surgeRepaymentFactorGamma: { type: Type.NUMBER },
                        shockShieldGracePeriodActive: { type: Type.BOOLEAN },
                        shockShieldMonthsGranted: { type: Type.INTEGER },
                        recommendedMicroSavingsSweepPercent: { type: Type.NUMBER },
                        bankUnderwritingJustification: { type: Type.STRING },
                      },
                      required: [
                        'underwritingDecision',
                        'approvedCreditLimit',
                        'repaymentStructure',
                        'shockShieldGracePeriodActive',
                        'bankUnderwritingJustification',
                      ],
                    },
                  },
                  required: ['borrowerId', 'bawsEngineState', 'statisticalMetrics', 'scoringProfile', 'adaptiveProductRecommendation'],
                },
              },
            });

            if (response.text) {
              geminiResponse = JSON.parse(response.text);
              break; // successfully generated
            }
          } catch (modelErr: any) {
            console.log(`Model ${modelName} returned status: ${modelErr?.status || modelErr?.message || 'error'}, trying next fallback...`);
          }
        }
      } catch (err) {
        console.warn('Gemini API call warning (using Building The Bank model fallback):', err);
      }
    }

    // Apply results to profile
    if (geminiResponse) {
      profile.bawsEngineState.optimalLookbackWindowK = geminiResponse.bawsEngineState.optimalLookbackWindowK;
      profile.bawsEngineState.structuralBreakDetected = geminiResponse.bawsEngineState.structuralBreakDetected;
      profile.bawsEngineState.operationalRegime = geminiResponse.bawsEngineState.operationalRegime;
      if (geminiResponse.bawsEngineState.breakReason) {
        profile.bawsEngineState.breakReason = geminiResponse.bawsEngineState.breakReason;
      }
      profile.scoringProfile.trustScore = geminiResponse.scoringProfile.trustScore;
      profile.scoringProfile.trustScore100 = Math.round((geminiResponse.scoringProfile.trustScore / 850) * 100);
      profile.scoringProfile.trustGrade = geminiResponse.scoringProfile.trustGrade;
      profile.scoringProfile.resilienceScore = geminiResponse.scoringProfile.resilienceScore;
      profile.scoringProfile.resilienceVerdict = geminiResponse.scoringProfile.resilienceVerdict;
      profile.adaptiveProductRecommendation = {
        ...profile.adaptiveProductRecommendation,
        ...geminiResponse.adaptiveProductRecommendation,
      };
    } else if (bawsModelResult) {
      // Use Building The Bank model outputs directly if Gemini is unavailable
      profile.bawsEngineState.optimalLookbackWindowK = bawsModelResult.bawsMetadata.optimalLookbackMonths;
      profile.bawsEngineState.structuralBreakDetected = bawsModelResult.bawsMetadata.structuralBreakDetected;
      profile.bawsEngineState.mbbBlockLength = bawsModelResult.bawsMetadata.mbbBlockLength;
      
      profile.statisticalMetrics = {
        meanPositiveCashFlow: bawsModelResult.riskMetrics.meanPositiveCashFlow,
        cashFlowVolatilitySigma: bawsModelResult.riskMetrics.stdDev,
        coefficientOfVariation: bawsModelResult.riskMetrics.coefficientOfVariation,
        consistencyRatio: bawsModelResult.riskMetrics.consistencyRatio,
        nonSeasonalShockFrequency: bawsModelResult.bawsMetadata.structuralBreakDetected ? 0.25 : 0.05,
        valueAtRisk90: bawsModelResult.riskMetrics.valueAtRisk90,
        expectedShortfall90: bawsModelResult.riskMetrics.expectedShortfall90,
        pinballLoss: bawsModelResult.riskMetrics.fisslerZiegelLoss,
        fisslerZiegelLoss: bawsModelResult.riskMetrics.fisslerZiegelLoss,
        varDeltaPercent: bawsModelResult.bawsMetadata.structuralBreakDetected ? 24 : -8,
      };

      profile.scoringProfile.trustScore = bawsModelResult.riskMetrics.trustScore;
      profile.scoringProfile.trustScore100 = Math.round((bawsModelResult.riskMetrics.trustScore / 850) * 100);
      profile.scoringProfile.resilienceScore = bawsModelResult.riskMetrics.resilienceScore;

      profile.adaptiveProductRecommendation = {
        ...profile.adaptiveProductRecommendation,
        underwritingDecision: bawsModelResult.adaptiveProductTerms.underwritingDecision,
        approvedCreditLimit: bawsModelResult.adaptiveProductTerms.creditFacilityLimit,
        baseCommitmentAmount: bawsModelResult.adaptiveProductTerms.baseMonthlyCommitment,
        surgeRepaymentFactorGamma: bawsModelResult.adaptiveProductTerms.surgeRepaymentFactorGamma,
        shockShieldGracePeriodActive: bawsModelResult.adaptiveProductTerms.shockShieldActive,
        shockShieldMonthsGranted: bawsModelResult.adaptiveProductTerms.gracePeriodMonthsAvailable,
      };
    } else {
      // Local math evaluation
      const stats = computeTailRiskMetrics(profile.cashFlowRecords, profile.bawsEngineState.optimalLookbackWindowK);
      const scoring = calculateBawsScores(stats, profile.currentLiquidBuffer, profile.bawsEngineState.structuralBreakDetected);
      profile.statisticalMetrics = { ...stats, varDeltaPercent: stats.coefficientOfVariation > 0.3 ? 12 : -5 };
      profile.scoringProfile = scoring;
    }

    setProfile(profile.borrowerId, profile);
    flushToDisk();

    res.json({
      success: true,
      profile,
      isAIEvaluated: Boolean(geminiResponse),
      buildingTheBankModel: bawsModelResult || null,
    });
  });

  // 6. Simulate Shock or Windfall Event
  app.post('/api/borrowers/:id/simulate-shock', async (req, res) => {
    const { scenarioType, shockMagnitude, description } = req.body;
    const profile = getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Borrower not found' });
    }

    const nextIndex = profile.cashFlowRecords.length + 1;
    const todayStr = new Date().toISOString().split('T')[0];

    if (scenarioType === 'CROP_PEST_SHOCK' || scenarioType === 'HEALTH_EMERGENCY') {
      // Exogenous deficit shock
      const dropInflow = Math.round(3500);
      const spikeOutflow = Math.round(18000 + (shockMagnitude || 5000));
      profile.cashFlowRecords.push({
        periodIndex: nextIndex,
        periodDate: todayStr,
        label: 'Shock Event',
        grossInflow: dropInflow,
        grossOutflow: spikeOutflow,
        netCashFlow: dropInflow - spikeOutflow,
        seasonTag: 'REGULAR',
        description: description || 'Exogenous crop pest infestation damage',
      });

      // Contract adaptive window to isolate structural break
      profile.bawsEngineState.optimalLookbackWindowK = 6;
      profile.bawsEngineState.structuralBreakDetected = true;
      profile.bawsEngineState.operationalRegime = 'EXOGENOUS_SHOCK';
      profile.bawsEngineState.breakReason = description || 'Exogenous severe income contraction detected.';
      profile.bawsEngineState.lastChangedAgo = 'Just now';

      profile.pressureStatusBanner = {
        isUnderPressure: true,
        title: 'Exogenous Shock Shield Activated',
        description: 'Structural break verified. Adaptive window contracted to k̂_t = 6. Automatic 60-day zero-interest grace period enabled with zero credit score impairment.',
        severity: 'alert',
      };

      profile.adaptiveProductRecommendation.shockShieldGracePeriodActive = true;
      profile.adaptiveProductRecommendation.shockShieldMonthsGranted = 2;
      profile.adaptiveProductRecommendation.currentDynamicEmi = 0;
      profile.loanFacility.shockShieldStatus = 'GRACE_PERIOD';
      profile.loanFacility.graceMonthsRemaining = 2;
      profile.loanFacility.currentAdaptiveEmi = 0;
    } else if (scenarioType === 'HARVEST_WINDFALL') {
      // Positive surge
      const surgeInflow = Math.round(48000);
      const regularOutflow = Math.round(12000);
      profile.cashFlowRecords.push({
        periodIndex: nextIndex,
        periodDate: todayStr,
        label: 'Harvest Surge',
        grossInflow: surgeInflow,
        grossOutflow: regularOutflow,
        netCashFlow: surgeInflow - regularOutflow,
        seasonTag: 'HARVEST',
        description: description || 'Bumper crop wholesale Mandi settlement',
      });

      // Expand adaptive window & auto-sweep micro-savings
      profile.bawsEngineState.optimalLookbackWindowK = 12;
      profile.bawsEngineState.structuralBreakDetected = false;
      profile.bawsEngineState.operationalRegime = 'STABLE_SEASONAL';
      profile.currentLiquidBuffer += Math.round(surgeInflow * 0.035); // 3.5% sweep

      profile.pressureStatusBanner = {
        isUnderPressure: false,
        title: 'Harvest Surge Inflow Captured',
        description: '3.5% micro-savings auto-swept into overnight liquid reserve. Lookback horizon expanded to k̂_t = 12.',
        severity: 'healthy',
      };
    } else if (scenarioType === 'RESET_DEFAULT') {
      const fresh = getInitialAartiProfile();
      setProfile(fresh.borrowerId, fresh);
      flushToDisk();
      return res.json({ success: true, profile: fresh });
    }

    // Recalculate metrics
    const stats = computeTailRiskMetrics(profile.cashFlowRecords, profile.bawsEngineState.optimalLookbackWindowK);
    const scoring = calculateBawsScores(stats, profile.currentLiquidBuffer, profile.bawsEngineState.structuralBreakDetected);
    profile.statisticalMetrics = { ...stats, varDeltaPercent: profile.bawsEngineState.structuralBreakDetected ? 24 : -8 };
    profile.scoringProfile = scoring;

    setProfile(profile.borrowerId, profile);
    flushToDisk();
    res.json({ success: true, profile });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start periodic flush (every 30s) and handle graceful shutdown
  const flushInterval = startPeriodicFlush(30_000);
  const shutdown = () => {
    console.log('[BAWS] Graceful shutdown — flushing state to disk...');
    clearInterval(flushInterval);
    flushToDisk();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BAWS Adaptive Risk Platform server running on port ${PORT} (http://localhost:${PORT})`);
  });
}

startServer();
