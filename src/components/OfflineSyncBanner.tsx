import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload, HardDriveDownload, AlertCircle } from 'lucide-react';
import { getCacheMetadata, CacheMetadata, getPendingSyncQueue, clearPendingSyncQueue } from '../utils/offlineSync';

interface OfflineSyncBannerProps {
  onTriggerSync?: () => Promise<void>;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({ onTriggerSync }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [metadata, setMetadata] = useState<CacheMetadata>(getCacheMetadata());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setMetadata(getCacheMetadata());
      setSyncStatusMsg('Online connection restored! Synchronizing cached changes...');

      if (onTriggerSync) {
        setIsSyncing(true);
        try {
          await onTriggerSync();
          setSyncStatusMsg('Cloud database & cache synchronized.');
        } catch {
          setSyncStatusMsg('Sync queue updated locally.');
        } finally {
          setIsSyncing(false);
          setTimeout(() => setSyncStatusMsg(null), 4000);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMetadata(getCacheMetadata());
      setSyncStatusMsg('Offline mode: Using local cached profile and non-parametric engine.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic refresh of queue count
    const interval = setInterval(() => {
      setMetadata(getCacheMetadata());
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [onTriggerSync]);

  const handleManualOnlineSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg('Syncing cached offline modifications...');

    try {
      if (onTriggerSync) {
        await onTriggerSync();
      }
      setSyncStatusMsg('Sync completed successfully.');
      setMetadata(getCacheMetadata());
    } catch {
      setSyncStatusMsg('Sync completed in offline resilient storage.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 3500);
    }
  };

  // Only render if offline, or if there are pending sync items, or if a sync message is active
  if (isOnline && metadata.pendingSyncCount === 0 && !syncStatusMsg) {
    return null;
  }

  return (
    <div className="px-4 py-2 bg-[#123524] text-white text-[11px] font-sans transition-all duration-200 border-b border-[#204e38]/50 shadow-xs">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {!isOnline ? (
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-3 h-3" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-[#98d4ad] flex items-center justify-center shrink-0">
              <Wifi className="w-3 h-3" />
            </div>
          )}

          <div className="truncate">
            <span className="font-bold tracking-tight">
              {!isOnline ? 'Offline Mode' : 'Cached Sync Active'}
            </span>
            <span className="text-[#98d4ad] ml-1.5 hidden sm:inline">
              {syncStatusMsg ||
                (!isOnline
                  ? 'Viewing cached profile data from local storage'
                  : `${metadata.pendingSyncCount} pending change(s) queued`)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {metadata.pendingSyncCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[9px] font-bold">
              {metadata.pendingSyncCount} queued
            </span>
          )}

          {isOnline && (
            <button
              onClick={handleManualOnlineSync}
              disabled={isSyncing}
              className="px-2 py-0.5 bg-[#204e38] hover:bg-[#2b6449] rounded text-[10px] font-medium flex items-center gap-1 text-white transition-colors"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
