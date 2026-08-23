import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  deleteUser,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { BorrowerProfile } from '../types';

// Fallback configuration if firebase-applet-config.json is absent (e.g. in git builds)
const defaultFirebaseConfig = {
  projectId: "boxwood-atom-476404-b5",
  appId: "1:917898093765:web:b3fb32d82d0c4cf9657cac",
  apiKey: "AIzaSyD1s2_MLw413Y4XNFel3TjxYDMgU9kXIQw",
  authDomain: "boxwood-atom-476404-b5.firebaseapp.com",
  firestoreDatabaseId: "(default)",
  storageBucket: "boxwood-atom-476404-b5.firebasestorage.app",
  messagingSenderId: "917898093765",
};

// Support environment variable overrides for production deployment (#16)
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (process.env || {});

const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || env.FIREBASE_FIRESTORE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore using configured or default database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export interface AppUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  role: 'borrower' | 'underwriter';
  linkedBorrowerId: string;
  sector?: string;
  currentLiquidBuffer?: number;
  targetBuffer?: number;
  optimalLookbackWindowK?: number;
  trustScore?: number;
  resilienceScore?: number;
  borrowerData?: Partial<BorrowerProfile>;
  borrowerProfile?: BorrowerProfile;
  createdAt?: any;
  lastLoginAt?: any;
  updatedAt?: any;
}

/**
 * Register a new user with Email and Password
 */
export async function registerWithEmailPassword(
  email: string,
  pass: string,
  displayName: string,
  role: 'borrower' | 'underwriter' = 'borrower'
): Promise<AppUserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // Update Auth Profile
  if (displayName) {
    await updateProfile(user, { displayName });
  }

  // Create Firestore Profile Document
  const profile: AppUserProfile = {
    uid: user.uid,
    email: user.email || email,
    displayName: displayName || email.split('@')[0],
    photoURL: user.photoURL || undefined,
    role,
    linkedBorrowerId: role === 'borrower' ? 'baws-user-aarti-8821' : 'nbfc-officer',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      ...profile,
      serverCreatedAt: serverTimestamp(),
      serverLastLogin: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore doc write skipped or pending permissions:', err);
  }

  return profile;
}

/**
 * Log in an existing user with Email and Password
 */
export async function loginWithEmailPassword(
  email: string,
  pass: string
): Promise<AppUserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // Fetch or sync Firestore Profile
  let profile: AppUserProfile = {
    uid: user.uid,
    email: user.email || email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || undefined,
    role: 'borrower',
    linkedBorrowerId: 'baws-user-aarti-8821',
    lastLoginAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      profile = {
        ...profile,
        displayName: data.displayName || profile.displayName,
        role: data.role || 'borrower',
        linkedBorrowerId: data.linkedBorrowerId || 'baws-user-aarti-8821',
        phoneNumber: data.phoneNumber || profile.phoneNumber,
        sector: data.sector,
        currentLiquidBuffer: data.currentLiquidBuffer,
        targetBuffer: data.targetBuffer,
        optimalLookbackWindowK: data.optimalLookbackWindowK,
        trustScore: data.trustScore,
        resilienceScore: data.resilienceScore,
        borrowerData: data.borrowerData,
      };
      await updateDoc(userDocRef, { serverLastLogin: serverTimestamp() });
    } else {
      await setDoc(userDocRef, {
        ...profile,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Firestore profile sync fallback:', err);
  }

  return profile;
}

/**
 * Log in an existing user, or register if the account does not exist yet
 */
export async function loginOrRegisterWithEmail(
  email: string,
  pass: string,
  displayName: string,
  role: 'borrower' | 'underwriter' = 'borrower'
): Promise<AppUserProfile> {
  try {
    return await loginWithEmailPassword(email, pass);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      return await registerWithEmailPassword(email, pass, displayName, role);
    }
    throw err;
  }
}

/**
 * Sign in or Register using Firebase Google Popup
 */
export async function loginWithGooglePopup(
  role: 'borrower' | 'underwriter' = 'borrower'
): Promise<AppUserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  let profile: AppUserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || 'Google User',
    photoURL: user.photoURL || undefined,
    role,
    linkedBorrowerId: 'baws-user-aarti-8821',
    lastLoginAt: new Date().toISOString(),
  };

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      profile = {
        ...profile,
        displayName: data.displayName || profile.displayName,
        role: data.role || role,
        linkedBorrowerId: data.linkedBorrowerId || 'baws-user-aarti-8821',
        phoneNumber: data.phoneNumber,
        sector: data.sector,
        currentLiquidBuffer: data.currentLiquidBuffer,
        borrowerData: data.borrowerData,
      };
      await updateDoc(userDocRef, { serverLastLogin: serverTimestamp() });
    } else {
      await setDoc(userDocRef, {
        ...profile,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn('Firestore Google profile sync:', err);
  }

  return profile;
}

/**
 * Save complete user information and financial telemetry state to Firestore database
 */
export async function saveUserComprehensiveData(
  userId: string,
  data: Partial<AppUserProfile> & { borrowerProfile?: BorrowerProfile }
): Promise<void> {
  if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    const payload: Record<string, any> = {
      ...data,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    };

    if (data.borrowerProfile) {
      payload.borrowerProfile = data.borrowerProfile;
      payload.borrowerData = {
        fullName: data.borrowerProfile.fullName,
        sector: data.borrowerProfile.sectorType,
        sectorLabel: data.borrowerProfile.sectorLabel,
        currentLiquidBuffer: data.borrowerProfile.currentLiquidBuffer,
        targetBuffer: data.borrowerProfile.scoringProfile.formulaBreakdown.liquidBuffer,
        trustScore: data.borrowerProfile.scoringProfile.trustScore,
        resilienceScore: data.borrowerProfile.scoringProfile.resilienceScore,
        optimalLookbackWindowK: data.borrowerProfile.bawsEngineState.optimalLookbackWindowK,
        connectedBankAccounts: data.borrowerProfile.connectedBankAccounts,
        actions: data.borrowerProfile.actions,
        passportCertId: data.borrowerProfile.passportCertId,
      };
    }

    await setDoc(userDocRef, payload, { merge: true });
  } catch (err) {
    console.error('Error saving user data to Firestore:', err);
    throw err;
  }
}

/**
 * Retrieve full user profile and stored data from Firestore
 */
export async function getUserComprehensiveData(userId: string): Promise<AppUserProfile | null> {
  if (!userId) return null;
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap && snap.exists()) {
      return snap.data() as AppUserProfile;
    }
    return null;
  } catch (err: any) {
    // If client is offline or network is disconnected, fallback gracefully to current state
    console.warn('Firestore user profile sync notice (operating with local state):', err?.message || err);
    return null;
  }
}

/**
 * Save a new loan application to the user's subcollection
 */
export async function saveUserLoanApplication(
  userId: string,
  loan: {
    requestedAmount: number;
    sector: string;
    safeLimit: number;
    status: 'approved' | 'under_review' | 'active' | 'cancelled';
  }
): Promise<string> {
  const loanId = `loan_${Date.now()}`;
  const loanDocRef = doc(db, 'users', userId, 'loans', loanId);
  await setDoc(loanDocRef, {
    ...loan,
    userId,
    loanId,
    timestamp: new Date().toISOString(),
    serverCreatedAt: serverTimestamp(),
  });
  return loanId;
}

/**
 * Log user activity event into Firestore
 */
export async function logUserActivity(
  userId: string,
  actionType: string,
  details: string
): Promise<void> {
  try {
    const logId = `log_${Date.now()}`;
    const logDocRef = doc(db, 'users', userId, 'activity_logs', logId);
    await setDoc(logDocRef, {
      userId,
      logId,
      actionType,
      details,
      timestamp: new Date().toISOString(),
      serverCreatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Activity logging skipped:', e);
  }
}

/**
 * Permanently delete the user's profile, all associated database records, and Firebase Auth account
 */
export async function deleteUserProfileAccount(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Delete all loan documents in subcollection
    try {
      const loansRef = collection(db, 'users', userId, 'loans');
      const loansSnap = await getDocs(loansRef);
      const deleteLoanPromises = loansSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteLoanPromises);
    } catch (e) {
      console.warn('Loans subcollection cleanup note:', e);
    }

    // 2. Delete all activity log documents
    try {
      const logsRef = collection(db, 'users', userId, 'activity_logs');
      const logsSnap = await getDocs(logsRef);
      const deleteLogPromises = logsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deleteLogPromises);
    } catch (e) {
      console.warn('Activity logs subcollection cleanup note:', e);
    }

    // 3. Delete the primary User Document
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);

    // 4. Delete the Auth User if currently logged in
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser && currentAuthUser.uid === userId) {
      await deleteUser(currentAuthUser);
    }

    // 5. Ensure sign out
    await signOut(auth);

    return {
      success: true,
      message: 'Your profile and all database records have been permanently deleted.',
    };
  } catch (err: any) {
    console.error('Error during profile deletion:', err);
    // If Firebase Auth requires recent login for auth account deletion
    if (err.code === 'auth/requires-recent-login') {
      throw new Error('For security, deleting your credentials requires a fresh login. Please log in again and retry.');
    }
    throw new Error(err.message || 'Failed to delete profile from database.');
  }
}

/**
 * Logout of Firebase
 */
export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}
