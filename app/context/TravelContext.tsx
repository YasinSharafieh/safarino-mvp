"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export type TravelData = {
  origin: string;
  destination: string;
  budget: number;
  days: number;
  tripStyle: string;
  quizResult: string;
  quizStep: number;
  quizAnswers: Record<string, string>;
  transport: Record<string, unknown> | null;
  accommodation: Record<string, unknown> | null;
};

type TravelContextValue = {
  travelData: TravelData;
  setTravelData: Dispatch<SetStateAction<TravelData>>;
  resetTravelData: () => void;
  isHydrated: boolean;
};

const STORAGE_KEY = "safarino-travel-data-v1";
const INITIAL_DATA: TravelData = {
  origin: "تهران",
  destination: "",
  budget: 15,
  days: 3,
  tripStyle: "",
  quizResult: "",
  quizStep: 0,
  quizAnswers: {},
  transport: null,
  accommodation: null,
};

const TravelContext = createContext<TravelContextValue | null>(null);

export function TravelProvider({ children }: { children: ReactNode }) {
  const [travelData, setTravelData] = useState<TravelData>(INITIAL_DATA);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<TravelData>;
        setTravelData((current) => ({
          ...current,
          ...parsed,
          quizAnswers: parsed.quizAnswers ?? {},
          transport: parsed.transport ?? null,
          accommodation: parsed.accommodation ?? null,
        }));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(travelData));
    } catch {
      // The in-memory context still works when browser storage is unavailable.
    }
  }, [isHydrated, travelData]);

  const resetTravelData = useCallback(() => {
    setTravelData(INITIAL_DATA);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const value = useMemo(
    () => ({ travelData, setTravelData, resetTravelData, isHydrated }),
    [isHydrated, resetTravelData, travelData],
  );

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) throw new Error("useTravel must be used inside TravelProvider");
  return context;
}
