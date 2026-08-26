import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'contrast';
export type FontScale = 'normal' | 'large' | 'xlarge';

interface ThemeContextType {
  theme: ThemeMode;
  fontScale: FontScale;
  reduceMotion: boolean;
  setTheme: (mode: ThemeMode) => void;
  setFontScale: (scale: FontScale) => void;
  setReduceMotion: (reduce: boolean) => void;
  toggleDarkMode: () => void;
  toggleHighContrast: () => void;
}

const THEME_STORAGE_KEY = 'baws_theme_mode';
const FONT_SCALE_KEY = 'baws_font_scale';
const REDUCE_MOTION_KEY = 'baws_reduce_motion';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'contrast' || stored === 'light') {
        return stored;
      }
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.warn('Could not read theme from storage', e);
    }
    return 'light';
  });

  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    try {
      const stored = localStorage.getItem(FONT_SCALE_KEY);
      if (stored === 'normal' || stored === 'large' || stored === 'xlarge') {
        return stored;
      }
    } catch {}
    return 'normal';
  });

  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(REDUCE_MOTION_KEY);
      if (stored !== null) return stored === 'true';
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
    } catch {}
    return false;
  });

  // Apply classes to document element and body
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Reset theme classes
    root.classList.remove('dark', 'theme-dark', 'theme-contrast', 'theme-light');
    body.classList.remove('dark', 'theme-dark', 'theme-contrast', 'theme-light');

    if (theme === 'dark') {
      root.classList.add('dark', 'theme-dark');
      body.classList.add('dark', 'theme-dark');
      root.style.colorScheme = 'dark';
    } else if (theme === 'contrast') {
      root.classList.add('theme-contrast');
      body.classList.add('theme-contrast');
      root.style.colorScheme = 'light';
    } else {
      root.classList.add('theme-light');
      body.classList.add('theme-light');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  // Apply font scale
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-scale-lg', 'font-scale-xl');
    if (fontScale === 'large') {
      root.classList.add('font-scale-lg');
    } else if (fontScale === 'xlarge') {
      root.classList.add('font-scale-xl');
    }

    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale);
    } catch {}
  }, [fontScale]);

  // Apply reduce motion
  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    try {
      localStorage.setItem(REDUCE_MOTION_KEY, String(reduceMotion));
    } catch {}
  }, [reduceMotion]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const setFontScale = useCallback((scale: FontScale) => {
    setFontScaleState(scale);
  }, []);

  const setReduceMotion = useCallback((reduce: boolean) => {
    setReduceMotionState(reduce);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setThemeState((prev) => (prev === 'contrast' ? 'light' : 'contrast'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        fontScale,
        reduceMotion,
        setTheme,
        setFontScale,
        setReduceMotion,
        toggleDarkMode,
        toggleHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
