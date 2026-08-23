import fs from 'fs';
import path from 'path';
import { BorrowerProfile } from '../src/types';
import { OAuthUser } from '../src/types';

/**
 * Lightweight persistence layer for server-side state.
 * 
 * On Render (or any ephemeral container), pure in-memory stores are wiped
 * on every deploy/restart. This module provides:
 * 
 * 1. In-memory cache for fast reads (same as before)
 * 2. Periodic flush to a JSON file on disk (survives process restarts within the same deploy)
 * 3. Load-from-disk on startup (recovers state after crash/restart)
 * 
 * LIMITATION: On Render free tier, the filesystem is ephemeral per deploy.
 * For true persistence across deploys, migrate to Firestore Admin SDK or
 * an external database (Postgres via Render, Redis, etc.).
 */

const DATA_DIR = process.env.PERSIST_DIR || path.join(process.cwd(), '.data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

// Ensure data directory exists
function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[Persist] Could not create data directory:', err);
  }
}

// --- Profiles Store ---

let profilesCache: Record<string, BorrowerProfile> = {};
let profilesDirty = false;

export function getProfilesStore(): Record<string, BorrowerProfile> {
  return profilesCache;
}

export function getProfile(id: string): BorrowerProfile | undefined {
  return profilesCache[id];
}

export function setProfile(id: string, profile: BorrowerProfile): void {
  profilesCache[id] = profile;
  profilesDirty = true;
}

export function deleteProfile(id: string): void {
  delete profilesCache[id];
  profilesDirty = true;
}

export function initProfiles(seedProfiles: BorrowerProfile[]): void {
  // Try loading from disk first
  const loaded = loadFromDisk<Record<string, BorrowerProfile>>(PROFILES_FILE);
  if (loaded && Object.keys(loaded).length > 0) {
    profilesCache = loaded;
    console.log(`[Persist] Loaded ${Object.keys(loaded).length} profiles from disk`);
    return;
  }

  // Fall back to seed data
  for (const prof of seedProfiles) {
    profilesCache[prof.borrowerId] = prof;
  }
  profilesDirty = true;
  console.log(`[Persist] Initialized ${seedProfiles.length} seed profiles`);
}

// --- Sessions Store ---

let sessionsCache: Record<string, OAuthUser> = {};
let sessionsDirty = false;

export function getSessionsStore(): Record<string, OAuthUser> {
  return sessionsCache;
}

export function getSession(id: string): OAuthUser | undefined {
  return sessionsCache[id];
}

export function setSession(id: string, user: OAuthUser): void {
  sessionsCache[id] = user;
  sessionsDirty = true;
}

export function deleteSession(id: string): void {
  delete sessionsCache[id];
  sessionsDirty = true;
}

export function getAllSessions(): OAuthUser[] {
  return Object.values(sessionsCache);
}

export function initSessions(seed: Record<string, OAuthUser>): void {
  const loaded = loadFromDisk<Record<string, OAuthUser>>(SESSIONS_FILE);
  if (loaded && Object.keys(loaded).length > 0) {
    sessionsCache = loaded;
    console.log(`[Persist] Loaded ${Object.keys(loaded).length} sessions from disk`);
    return;
  }
  sessionsCache = { ...seed };
  sessionsDirty = true;
}

// --- Access Tokens Store ---

export interface AccessTokenEntry {
  accessToken: string;
  itemId: string;
  provider: 'PLAID' | 'ACCOUNT_AGGREGATOR';
}

let tokensCache: Record<string, AccessTokenEntry> = {};
let tokensDirty = false;

export function getTokensStore(): Record<string, AccessTokenEntry> {
  return tokensCache;
}

export function getToken(userId: string): AccessTokenEntry | undefined {
  return tokensCache[userId];
}

export function setToken(userId: string, entry: AccessTokenEntry): void {
  tokensCache[userId] = entry;
  tokensDirty = true;
}

export function initTokens(): void {
  const loaded = loadFromDisk<Record<string, AccessTokenEntry>>(TOKENS_FILE);
  if (loaded && Object.keys(loaded).length > 0) {
    tokensCache = loaded;
    console.log(`[Persist] Loaded ${Object.keys(loaded).length} access tokens from disk`);
  }
}

// --- Disk I/O ---

function loadFromDisk<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`[Persist] Failed to load ${filePath}:`, err);
  }
  return null;
}

function saveToDisk(filePath: string, data: unknown): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[Persist] Failed to save ${filePath}:`, err);
  }
}

/**
 * Flush all dirty stores to disk. Call this periodically or after mutations.
 */
export function flushToDisk(): void {
  if (profilesDirty) {
    saveToDisk(PROFILES_FILE, profilesCache);
    profilesDirty = false;
  }
  if (sessionsDirty) {
    saveToDisk(SESSIONS_FILE, sessionsCache);
    sessionsDirty = false;
  }
  if (tokensDirty) {
    saveToDisk(TOKENS_FILE, tokensCache);
    tokensDirty = false;
  }
}

/**
 * Start a periodic flush interval (default every 30 seconds).
 * Returns the interval handle for cleanup.
 */
export function startPeriodicFlush(intervalMs = 30_000): ReturnType<typeof setInterval> {
  ensureDataDir();
  return setInterval(() => {
    flushToDisk();
  }, intervalMs);
}
