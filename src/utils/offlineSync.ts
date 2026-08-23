import { BorrowerProfile, OAuthUser } from '../types';
import { getInitialAartiProfile } from '../utils/bawsEngine';

const PROFILE_CACHE_KEY_PREFIX = 'baws_profile_cache_';
const ACTIVE_PROFILE_ID_KEY = 'baws_active_profile_id';
const PROFILES_CATALOG_KEY = 'baws_profiles_catalog';
const CACHE_METADATA_KEY = 'baws_cache_metadata';
const PENDING_CHANGES_QUEUE_KEY = 'baws_pending_sync_queue';
const CACHED_AUTH_USER_KEY = 'baws_cached_auth_user';

export interface CacheMetadata {
  lastUpdated: string;
  isOffline: boolean;
  pendingSyncCount: number;
  activeProfileId: string;
  cachedProfilesCount: number;
}

export interface PendingSyncItem {
  id: string;
  timestamp: string;
  type: 'ACTION' | 'PROFILE_UPDATE' | 'SIMULATION' | 'BUFFER_SWEEP';
  borrowerId: string;
  payload: any;
}

/**
 * Save current active profile to LocalStorage cache
 */
export function cacheBorrowerProfile(profile: BorrowerProfile): void {
  try {
    const key = `${PROFILE_CACHE_KEY_PREFIX}${profile.borrowerId}`;
    const payload = {
      profile,
      cachedAt: new Date().toISOString(),
      version: 1,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profile.borrowerId);

    // Update catalog of cached profile IDs
    const catalog = getCachedProfilesCatalog();
    if (!catalog.includes(profile.borrowerId)) {
      catalog.push(profile.borrowerId);
      localStorage.setItem(PROFILES_CATALOG_KEY, JSON.stringify(catalog));
    }

    updateCacheMetadata();
  } catch (error) {
    console.warn('LocalStorage cache write error:', error);
  }
}

/**
 * Retrieve cached profile by borrowerId (or active profile if none passed)
 */
export function getCachedBorrowerProfile(borrowerId?: string): BorrowerProfile | null {
  try {
    const id = borrowerId || localStorage.getItem(ACTIVE_PROFILE_ID_KEY) || 'baws-user-aarti-8821';
    const key = `${PROFILE_CACHE_KEY_PREFIX}${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed.profile || parsed;
  } catch (error) {
    console.warn('LocalStorage cache read error:', error);
    return null;
  }
}

/**
 * Save array of profiles (e.g. Archetypes) to cache
 */
export function cacheMultipleProfiles(profiles: BorrowerProfile[]): void {
  try {
    profiles.forEach((p) => {
      const key = `${PROFILE_CACHE_KEY_PREFIX}${p.borrowerId}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          profile: p,
          cachedAt: new Date().toISOString(),
          version: 1,
        })
      );
    });

    const ids = profiles.map((p) => p.borrowerId);
    localStorage.setItem(PROFILES_CATALOG_KEY, JSON.stringify(ids));
    updateCacheMetadata();
  } catch (error) {
    console.warn('LocalStorage bulk cache write error:', error);
  }
}

/**
 * Retrieve all cached profiles
 */
export function getAllCachedProfiles(): BorrowerProfile[] {
  try {
    const catalog = getCachedProfilesCatalog();
    const profiles: BorrowerProfile[] = [];

    for (const id of catalog) {
      const p = getCachedBorrowerProfile(id);
      if (p) profiles.push(p);
    }

    return profiles;
  } catch {
    return [];
  }
}

/**
 * Get list of profile IDs currently in cache
 */
export function getCachedProfilesCatalog(): string[] {
  try {
    const raw = localStorage.getItem(PROFILES_CATALOG_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse profile catalog:', e);
  }
  return ['baws-user-aarti-8821'];
}

/**
 * Cache current authenticated user session
 */
export function cacheAuthUser(user: OAuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(CACHED_AUTH_USER_KEY);
    } else {
      localStorage.setItem(CACHED_AUTH_USER_KEY, JSON.stringify(user));
    }
  } catch (e) {
    console.warn('Error caching auth user:', e);
  }
}

/**
 * Get cached user session
 */
export function getCachedAuthUser(): OAuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_AUTH_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Queue a transaction or mutation when offline so it can sync when online
 */
export function enqueuePendingSync(
  type: PendingSyncItem['type'],
  borrowerId: string,
  payload: any
): void {
  try {
    const queue = getPendingSyncQueue();
    const newItem: PendingSyncItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      type,
      borrowerId,
      payload,
    };
    queue.push(newItem);
    localStorage.setItem(PENDING_CHANGES_QUEUE_KEY, JSON.stringify(queue));
    updateCacheMetadata();
  } catch (e) {
    console.warn('Error enqueuing offline change:', e);
  }
}

/**
 * Retrieve pending sync queue
 */
export function getPendingSyncQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(PENDING_CHANGES_QUEUE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    return [];
  }
  return [];
}

/**
 * Clear the pending sync queue after successful online synchronization
 */
export function clearPendingSyncQueue(): void {
  localStorage.removeItem(PENDING_CHANGES_QUEUE_KEY);
  updateCacheMetadata();
}

/**
 * Get sync and cache status metadata
 */
export function getCacheMetadata(): CacheMetadata {
  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const pendingQueue = getPendingSyncQueue();
  const catalog = getCachedProfilesCatalog();
  const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY) || 'baws-user-aarti-8821';

  let lastUpdated = new Date().toISOString();
  try {
    const raw = localStorage.getItem(CACHE_METADATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      lastUpdated = parsed.lastUpdated || lastUpdated;
    }
  } catch {}

  return {
    lastUpdated,
    isOffline,
    pendingSyncCount: pendingQueue.length,
    activeProfileId: activeId,
    cachedProfilesCount: catalog.length,
  };
}

function updateCacheMetadata(): void {
  try {
    const pendingQueue = getPendingSyncQueue();
    const catalog = getCachedProfilesCatalog();
    const activeId = localStorage.getItem(ACTIVE_PROFILE_ID_KEY) || 'baws-user-aarti-8821';
    const metadata: CacheMetadata = {
      lastUpdated: new Date().toISOString(),
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      pendingSyncCount: pendingQueue.length,
      activeProfileId: activeId,
      cachedProfilesCount: catalog.length,
    };
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch {}
}

/**
 * Registers the Service Worker for offline PWA asset and API response caching
 */
export function registerOfflineServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[BAWS ServiceWorker] Registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[BAWS ServiceWorker] Registration fallback:', err);
        });
    });
  }
}
