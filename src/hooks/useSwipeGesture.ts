import React, { useState, useRef, useCallback } from 'react';
import { TabType } from '../components/BottomNav';

export const ORDERED_TABS: TabType[] = ['home', 'cashflow', 'actions', 'more'];

interface UseSwipeGestureOptions {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  enabled?: boolean;
  minSwipeDistance?: number;
  maxSwipeTimeMs?: number;
}

export function useSwipeGesture({
  activeTab,
  onChangeTab,
  enabled = true,
  minSwipeDistance = 45,
  maxSwipeTimeMs = 500,
}: UseSwipeGestureOptions) {
  const [direction, setDirection] = useState<number>(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number; target: EventTarget | null } | null>(null);
  const isSwipingRef = useRef(false);

  const currentIndex = ORDERED_TABS.indexOf(activeTab);
  const canSwipeLeft = currentIndex < ORDERED_TABS.length - 1; // can move to next tab
  const canSwipeRight = currentIndex > 0; // can move to prev tab

  const handleTabChangeWithDirection = useCallback((newTab: TabType) => {
    const newIndex = ORDERED_TABS.indexOf(newTab);
    const prevIndex = ORDERED_TABS.indexOf(activeTab);
    setDirection(newIndex > prevIndex ? 1 : -1);
    onChangeTab(newTab);
  }, [activeTab, onChangeTab]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    if (!touch) return;

    // Check if touch is on an element that opts out of global tab swipe (e.g. range sliders, horizontal carousels, action swipe cards)
    const target = e.target as HTMLElement | null;
    if (target) {
      if (
        target.closest('[data-no-tab-swipe="true"]') ||
        target.closest('input[type="range"]') ||
        target.closest('.no-tab-swipe')
      ) {
        touchStartRef.current = null;
        return;
      }
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      target: e.target,
    };
    isSwipingRef.current = false;
  }, [enabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // If vertical scroll delta is significantly larger than horizontal, cancel horizontal gesture
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.4 && Math.abs(deltaY) > 15) {
      touchStartRef.current = null;
      isSwipingRef.current = false;
      return;
    }

    if (Math.abs(deltaX) > 10) {
      isSwipingRef.current = true;
    }
  }, [enabled]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStartRef.current) {
      touchStartRef.current = null;
      isSwipingRef.current = false;
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      isSwipingRef.current = false;
      return;
    }

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const elapsedTime = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;
    isSwipingRef.current = false;

    // Validate swipe: must exceed minimum horizontal distance, be faster than maxSwipeTime, and be primarily horizontal
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
    const isDistanceSufficient = Math.abs(deltaX) >= minSwipeDistance;
    const isFastEnough = elapsedTime <= maxSwipeTimeMs;

    if (isHorizontal && isDistanceSufficient && isFastEnough) {
      if (deltaX < 0 && canSwipeLeft) {
        // Swiped Left (finger moved Right to Left) -> Next tab
        const nextTab = ORDERED_TABS[currentIndex + 1];
        if (nextTab) {
          try {
            if ('vibrate' in navigator) navigator.vibrate(10);
          } catch {
            // ignore vibrate errors
          }
          setDirection(1);
          onChangeTab(nextTab);
        }
      } else if (deltaX > 0 && canSwipeRight) {
        // Swiped Right (finger moved Left to Right) -> Prev tab
        const prevTab = ORDERED_TABS[currentIndex - 1];
        if (prevTab) {
          try {
            if ('vibrate' in navigator) navigator.vibrate(10);
          } catch {
            // ignore vibrate errors
          }
          setDirection(-1);
          onChangeTab(prevTab);
        }
      }
    }
  }, [enabled, minSwipeDistance, maxSwipeTimeMs, canSwipeLeft, canSwipeRight, currentIndex, onChangeTab]);

  return {
    direction,
    setDirection,
    handleTabChangeWithDirection,
    canSwipeLeft,
    canSwipeRight,
    containerProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
