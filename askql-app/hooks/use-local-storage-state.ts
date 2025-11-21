"use client";

import { useState, useEffect } from "react";

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, boolean] {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState<T>(defaultValue);

  // Set mounted state after hydration
  useEffect(() => {
    setMounted(true);
    
    // Load saved value from localStorage
    const savedValue = localStorage.getItem(key);
    if (savedValue !== null) {
      try {
        const parsedValue = JSON.parse(savedValue);
        setValue(parsedValue);
      } catch {
        // If parsing fails, treat as string
        setValue(savedValue as T);
      }
    }
  }, [key]);

  // Persist value to localStorage
  useEffect(() => {
    if (!mounted) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Fallback for non-serializable values
      localStorage.setItem(key, String(value));
    }
  }, [key, value, mounted]);

  return [value, setValue, mounted];
}
