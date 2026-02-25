"use client";

import { useCallback } from "react";

export function useDemoMode() {
  const demoMode = false;
  const ready = true;

  const setDemoMode = useCallback((next: boolean) => {
    void next;
    // Demo mode is disabled during pre-launch QA.
  }, []);

  const toggleDemoMode = useCallback(() => {
    // Demo mode is disabled during pre-launch QA.
  }, []);

  return { demoMode, setDemoMode, toggleDemoMode, ready };
}
