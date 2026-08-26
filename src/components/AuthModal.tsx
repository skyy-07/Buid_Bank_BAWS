import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  LogOut,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  Flame,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  auth,
  registerWithEmailPassword,
  loginWithEmailPassword,
  loginOrRegisterWithEmail,
  loginWithGooglePopup,
  logoutFirebase,
  deleteUserProfileAccount,
  AppUserProfile,
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { OAuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: OAuthUser | null;
  onUserChanged: (user: OAuthUser | null) => void;
  onDeleteProfile?: (userId: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = React.memo(({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
  onDeleteProfile,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'borrower' | 'underwriter'>('borrower');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Deletion modal state inside auth modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const mappedUser: OAuthUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          picture: firebaseUser.photoURL || undefined,
          provider: firebaseUser.providerData[0]?.providerId.includes('google') ? 'google' : 'demo',
          role: selectedRole,
          linkedBorrowerId: 'baws-user-aarti-8821',
          loginTimestamp: new Date().toISOString(),
        };
        onUserChanged(mappedUser);
      }
    });

    return () => unsubscribe();
  }, [selectedRole, onUserChanged]);

  if (!isOpen) return null;

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    if (password.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
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
        onUserChanged(mapped);
        setStatusMessage({
          type: 'success',
          text: `Account created successfully! Welcome to BAWS, ${mapped.name}.`,
        });
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
        onUserChanged(mapped);
        setStatusMessage({
          type: 'success',
          text: `Logged in successfully as ${mapped.name}.`,
        });
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
            ? 'Account not found with this email/password. If you have not created an account yet, switch to "Create New Account" or click below.'
            : 'Invalid credentials. Please verify your email and password.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'An account with this email already exists. Switch to "Log In" tab above to sign in.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password is too weak. Please choose at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address format.';
      } else {
        console.warn('Firebase Auth notice:', err.code || err.message);
      }
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
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
      onUserChanged(mapped);
      setStatusMessage({
        type: 'success',
        text: `Signed in with Google as ${mapped.name}!`,
      });
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setStatusMessage({
          type: 'info',
          text: 'Google sign-in popup was closed before completion. You can retry anytime.',
        });
      } else if (err.code === 'auth/popup-blocked') {
        setStatusMessage({
          type: 'error',
          text: 'Google popup was blocked by browser. Please allow popups or use Email & Password login.',
        });
      } else {
        console.warn('Google Auth notice:', err.message || err.code);
        setStatusMessage({
          type: 'error',
          text: err.message || 'Google sign in encountered an issue. You can use Email & Password below.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantDemoLogin = async (
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
        picture: profile.photoURL,
        provider: 'demo',
        role: profile.role,
        linkedBorrowerId: profile.linkedBorrowerId,
        loginTimestamp: new Date().toISOString(),
      };
      onUserChanged(mapped);
      setStatusMessage({
        type: 'success',
        text: `Logged in as ${mapped.name} (${mapped.role.toUpperCase()})`,
      });
    } catch (err: any) {
      console.warn('Demo login notice:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to authenticate demo account.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutFirebase();
      onUserChanged(null);
      setStatusMessage({ type: 'info', text: 'You have been signed out.' });
    } catch (err: any) {
      console.warn('Logout notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    try {
      if (onDeleteProfile) {
        await onDeleteProfile(currentUser.id);
      } else {
        await deleteUserProfileAccount(currentUser.id);
      }
      onUserChanged(null);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to delete user profile from Firestore.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs touch-manipulation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="auth-modal-sheet"
        className="bg-[#fdfbf7] w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[92vh] overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        {/* Mobile Drag Pill */}
        <div className="w-10 h-1.25 bg-[#d6cbba] rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4.5 bg-white border-b border-[#eee7da] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#123524] text-[#98d4ad] flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#123524]">
                Firebase Authentication & Firestore
              </h2>
              <p className="text-[11px] text-[#6e7f74]">
                Secure Account Registration & Cloud Sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f4efe4] hover:bg-[#eae3d2] flex items-center justify-center text-[#123524] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Login vs Sign Up */}
        <div className="px-6 pt-3 bg-white border-b border-[#eee7da] flex items-center gap-4">
          <button
            onClick={() => {
              setAuthMode('login');
              setStatusMessage(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              authMode === 'login'
                ? 'border-[#123524] text-[#123524]'
                : 'border-transparent text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In to Existing Account</span>
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setStatusMessage(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              authMode === 'signup'
                ? 'border-[#123524] text-[#123524]'
                : 'border-transparent text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create New Account</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Active Session Info if Logged in */}
          {currentUser && (
            <div className="bg-white rounded-2xl p-4 border border-[#e5ded0] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-bold bg-[#eef7f2] px-2 py-0.5 rounded-full border border-[#cbe4d4]">
                  Active Firebase Session
                </span>
                <span className="text-[10px] font-mono text-[#6e7f74]">
                  UID: {currentUser.id.slice(0, 10)}...
                </span>
              </div>

              <div className="flex items-center gap-3 pt-1">
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-[#123524]/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#123524] text-white flex items-center justify-center font-display font-bold text-base">
                    {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-display text-sm font-bold text-[#123524] truncate">
                    {currentUser.name}
                  </h4>
                  <p className="text-xs font-mono text-[#55695c] truncate">{currentUser.email}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.2 bg-[#f4efe4] text-[#123524] text-[9px] font-mono font-bold rounded">
                    ROLE: {currentUser.role.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#f0eae0] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeleteInput('');
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Profile</span>
                </button>

                <button
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] border border-[#dcd4c3] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
                statusMessage.type === 'success'
                  ? 'bg-[#eef7f2] border-[#cbe4d4] text-[#123524]'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-[#faf8f2] border-[#e8e2d5] text-[#123524]'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              {statusMessage.type === 'info' && <ShieldCheck className="w-4 h-4 text-[#123524] shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Google Sign In Option */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full p-3 bg-white hover:bg-[#faf7f0] border border-[#dcd4c3] rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-xs group active:scale-99 disabled:opacity-50"
          >
            <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
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
              Continue with Firebase Google Auth
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-px bg-[#e5ded0] flex-1"></div>
            <span className="text-[10px] font-mono uppercase text-[#8a998f]">or with email</span>
            <div className="h-px bg-[#e5ded0] flex-1"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordAuth} className="space-y-3">
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
              <label className="block text-[11px] font-semibold text-[#123524] mb-1.5">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRole('borrower')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedRole === 'borrower'
                      ? 'bg-[#123524] text-white border-[#123524]'
                      : 'bg-white text-[#123524] border-[#dcd4c3]'
                  }`}
                >
                  <div className="font-semibold text-xs">Borrower</div>
                  <div className={`text-[10px] ${selectedRole === 'borrower' ? 'text-[#a2d8b5]' : 'text-[#6e7f74]'}`}>
                    Farmer / MSME Retail
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('underwriter')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedRole === 'underwriter'
                      ? 'bg-[#123524] text-white border-[#123524]'
                      : 'bg-white text-[#123524] border-[#dcd4c3]'
                  }`}
                >
                  <div className="font-semibold text-xs">NBFC Risk Desk</div>
                  <div className={`text-[10px] ${selectedRole === 'underwriter' ? 'text-[#a2d8b5]' : 'text-[#6e7f74]'}`}>
                    Underwriter Officer
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#123524] hover:bg-[#1a4a33] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 mt-2"
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
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Demo Helper */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6e7f74] block">
                Instant 1-Click Test Accounts
              </span>
              <span className="text-[9px] font-mono text-emerald-800 bg-[#eef7f2] px-1.5 py-0.5 rounded font-semibold border border-[#cbe4d4]">
                Auto-Registered
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleInstantDemoLogin('nilavra.s2007@gmail.com', 'password123', 'Nilavra Sen', 'borrower')}
                className="flex-1 p-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] rounded-xl text-xs font-semibold text-center transition-all shadow-2xs active:scale-98 disabled:opacity-50"
              >
                <div>Nilavra Sen</div>
                <div className="text-[10px] text-[#55695c] font-normal">Borrower Account</div>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleInstantDemoLogin('underwriter@nbfc-risk.in', 'password123', 'Dev Sharma', 'underwriter')}
                className="flex-1 p-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] rounded-xl text-xs font-semibold text-center transition-all shadow-2xs active:scale-98 disabled:opacity-50"
              >
                <div>Dev Sharma</div>
                <div className="text-[10px] text-[#55695c] font-normal">NBFC Underwriter</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-[#eee7da] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[#6e7f74]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Firebase Auth (Email/Pass + Firestore)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] text-xs font-semibold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Nested Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#123524]">
                  Confirm Profile Deletion
                </h3>
                <p className="text-[11px] text-rose-700">Wipes cloud data & auth account</p>
              </div>
            </div>

            <p className="text-xs text-[#4a5c50] leading-relaxed">
              This will permanently delete your Firestore user document at <strong>/users/{currentUser?.id}</strong> and your authentication record.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#123524] block">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-white border border-[#dcd4c3] focus:border-rose-600 rounded-xl text-xs text-[#123524] font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] text-xs font-semibold rounded-xl transition-all border border-[#dcd4c3] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteInput.trim() !== 'DELETE' || isDeleting}
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-40"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete Forever'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
