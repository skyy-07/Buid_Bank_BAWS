import React, { useState, useCallback } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Landmark,
  Wheat,
} from 'lucide-react';
import {
  registerWithEmailPassword,
  loginWithEmailPassword,
  loginOrRegisterWithEmail,
  loginWithGooglePopup,
  AppUserProfile,
} from '../lib/firebase';
import { OAuthUser } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: OAuthUser) => void;
  isDeviceFrameView?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = React.memo(({
  onLoginSuccess,
  isDeviceFrameView = true,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'borrower' | 'underwriter'>('borrower');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMessage({ type: 'error', text: 'Please enter your email and password.' });
      return;
    }

    if (password.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      if (authMode === 'signup') {
        const profile = await registerWithEmailPassword(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0],
          selectedRole
        );
        const mapped: OAuthUser = {
          id: profile.uid,
          email: profile.email,
          name: profile.displayName,
          picture: profile.photoURL,
          provider: 'demo',
          role: profile.role,
          linkedBorrowerId: profile.linkedBorrowerId,
          loginTimestamp: new Date().toISOString(),
        };
        setStatusMessage({
          type: 'success',
          text: `Account created successfully! Welcome, ${mapped.name}.`,
        });
        setTimeout(() => onLoginSuccess(mapped), 400);
      } else {
        const profile = await loginWithEmailPassword(email.trim(), password);
        const mapped: OAuthUser = {
          id: profile.uid,
          email: profile.email,
          name: profile.displayName,
          picture: profile.photoURL,
          provider: 'demo',
          role: profile.role,
          linkedBorrowerId: profile.linkedBorrowerId,
          loginTimestamp: new Date().toISOString(),
        };
        setStatusMessage({
          type: 'success',
          text: `Welcome back, ${mapped.name}!`,
        });
        setTimeout(() => onLoginSuccess(mapped), 400);
      }
    } catch (err: any) {
      let errMsg = err.message || 'Authentication failed.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        errMsg =
          authMode === 'login'
            ? 'Account not found with this email/password. Please verify your credentials or switch to "Create New Account".'
            : 'Invalid credentials. Please verify your email and password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email already exists. Please switch to "Log In" above.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address.';
      }
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  }, [email, password, displayName, selectedRole, authMode, onLoginSuccess]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const profile = await loginWithGooglePopup(selectedRole);
      const mapped: OAuthUser = {
        id: profile.uid,
        email: profile.email,
        name: profile.displayName,
        picture: profile.photoURL,
        provider: 'google',
        role: profile.role,
        linkedBorrowerId: profile.linkedBorrowerId,
        loginTimestamp: new Date().toISOString(),
      };
      setStatusMessage({
        type: 'success',
        text: `Signed in with Google as ${mapped.name}!`,
      });
      setTimeout(() => onLoginSuccess(mapped), 400);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setStatusMessage({
          type: 'info',
          text: 'Google sign-in popup was closed. You can retry anytime or use email/password below.',
        });
      } else if (err.code === 'auth/popup-blocked') {
        setStatusMessage({
          type: 'error',
          text: 'Popup was blocked by browser. Please enable popups or use email login below.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Google sign-in encountered an issue.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole, onLoginSuccess]);

  const handleInstantDemoLogin = useCallback(async (
    demoEmail: string,
    demoPass: string,
    demoName: string,
    role: 'borrower' | 'underwriter'
  ) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setDisplayName(demoName);
    setSelectedRole(role);
    setIsLoading(true);
    setStatusMessage({ type: 'info', text: `Signing in as ${demoName}...` });

    try {
      const profile = await loginOrRegisterWithEmail(demoEmail, demoPass, demoName, role);
      const mapped: OAuthUser = {
        id: profile.uid,
        email: profile.email,
        name: profile.displayName,
        picture:
          role === 'borrower'
            ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        provider: 'demo',
        role: profile.role,
        linkedBorrowerId: profile.linkedBorrowerId,
        loginTimestamp: new Date().toISOString(),
      };
      setStatusMessage({
        type: 'success',
        text: `Logged in as ${mapped.name} (${mapped.role.toUpperCase()})`,
      });
      setTimeout(() => onLoginSuccess(mapped), 400);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to authenticate test account.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [onLoginSuccess]);

  return (
    <div className="min-h-full flex flex-col justify-center px-4 py-8 max-w-md mx-auto">
      {/* Brand Hero */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#123524] text-[#98d4ad] shadow-lg shadow-[#123524]/10 mb-3 border border-[#1b4d35]">
          <Wheat className="w-7 h-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#123524] tracking-tight">
          BAWS Adaptive Finance
        </h1>
        <p className="text-xs text-[#55695c] mt-1 max-w-xs mx-auto">
          Borrower-Adaptive Working Capital System with Real-Time Bank & Climate Telemetry
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xl space-y-4">
        {/* Tab Toggle */}
        <div className="flex bg-[#f4efe4] p-1 rounded-2xl border border-[#e5ded0]">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'login'
                ? 'bg-white text-[#123524] shadow-xs'
                : 'text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setStatusMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'signup'
                ? 'bg-white text-[#123524] shadow-xs'
                : 'text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-[#eef7f2] border-[#cbe4d4] text-[#123524]'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-[#faf8f2] border-[#e8e2d5] text-[#123524]'
            }`}
          >
            {statusMessage.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {statusMessage.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            {statusMessage.type === 'info' && (
              <ShieldCheck className="w-4 h-4 text-[#123524] shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* Google Authentication Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-white hover:bg-[#faf7f0] border border-[#dcd4c3] rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-2xs group active:scale-99 disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="font-semibold text-xs text-[#123524]">
            Continue with Google
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px bg-[#e5ded0] flex-1"></div>
          <span className="text-[10px] font-mono uppercase text-[#8a998f]">or with email</span>
          <div className="h-px bg-[#e5ded0] flex-1"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {authMode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#123524] mb-1">
                Full Name / Business Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8a998f] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Aarti Patel"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#dcd4c3] focus:border-[#123524] rounded-xl text-xs text-[#123524] focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#123524] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8a998f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#dcd4c3] focus:border-[#123524] rounded-xl text-xs text-[#123524] focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#123524] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8a998f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#dcd4c3] focus:border-[#123524] rounded-xl text-xs text-[#123524] focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Account Role Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-[#123524] mb-1">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('borrower')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  selectedRole === 'borrower'
                    ? 'bg-[#123524] text-white border-[#123524] shadow-xs'
                    : 'bg-white text-[#123524] border-[#dcd4c3] hover:border-[#123524]/40'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1">
                  <Wheat className="w-3.5 h-3.5" />
                  <span>Borrower</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    selectedRole === 'borrower' ? 'text-[#a2d8b5]' : 'text-[#6e7f74]'
                  }`}
                >
                  Farmer / MSME Retail
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('underwriter')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  selectedRole === 'underwriter'
                    ? 'bg-[#123524] text-white border-[#123524] shadow-xs'
                    : 'bg-white text-[#123524] border-[#dcd4c3] hover:border-[#123524]/40'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Risk Officer</span>
                </div>
                <div
                  className={`text-[10px] mt-0.5 ${
                    selectedRole === 'underwriter' ? 'text-[#a2d8b5]' : 'text-[#6e7f74]'
                  }`}
                >
                  NBFC Credit Desk
                </div>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#123524] hover:bg-[#1a4a33] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 mt-1"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            ) : authMode === 'signup' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Firebase Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Log In to Application</span>
              </>
            )}
          </button>
        </form>

        {/* Instant Sandbox Accounts */}
        <div className="pt-2 border-t border-[#f0eae0]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6e7f74]">
              Instant 1-Click Access
            </span>
            <span className="text-[9px] font-mono text-emerald-800 bg-[#eef7f2] px-1.5 py-0.5 rounded font-semibold border border-[#cbe4d4]">
              Auto-Authenticate
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                handleInstantDemoLogin(
                  'nilavra.s2007@gmail.com',
                  'password123',
                  'Nilavra Sen',
                  'borrower'
                )
              }
              className="p-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] rounded-xl text-left transition-all border border-[#e5ded0] active:scale-98 disabled:opacity-50"
            >
              <div className="font-semibold text-xs">Nilavra Sen</div>
              <div className="text-[10px] text-[#55695c]">Borrower Account</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                handleInstantDemoLogin(
                  'underwriter@nbfc-risk.in',
                  'password123',
                  'Dev Sharma',
                  'underwriter'
                )
              }
              className="p-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] rounded-xl text-left transition-all border border-[#e5ded0] active:scale-98 disabled:opacity-50"
            >
              <div className="font-semibold text-xs">Dev Sharma</div>
              <div className="text-[10px] text-[#55695c]">NBFC Underwriter</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center mt-4 text-[11px] text-[#6e7f74] flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
        <span>Firebase Cloud Authentication & Firestore Security Rules</span>
      </div>
    </div>
  );
});
