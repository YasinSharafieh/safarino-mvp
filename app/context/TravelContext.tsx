"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export type TravelData = {
  origin: string;
  destination: string;
  budget: number;
  days: number;
  departureDate: string;
  returnDate: string;
  travelers: number;
  children: number;
  infants: number;
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
  departureDate: "",
  returnDate: "",
  travelers: 2,
  children: 0,
  infants: 0,
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

  useEffect(() => {
    if (!isHydrated || travelData.accommodation?.status !== "selected") return;
    const saved = travelData.accommodation;
    const incompatibleCity = typeof saved.city === "string" && Boolean(travelData.destination) && saved.city !== travelData.destination;
    const incompatibleArrival = typeof saved.checkIn === "string" && Boolean(travelData.departureDate) && saved.checkIn !== travelData.departureDate;
    const hasTransportReturn = Boolean(travelData.returnDate) && travelData.returnDate > travelData.departureDate;
    const incompatibleCheckout = hasTransportReturn
      ? typeof saved.checkOut === "string" && saved.checkOut !== travelData.returnDate
      : typeof saved.nights === "number" && saved.nights !== travelData.days;
    const incompatibleTravelers =
      typeof saved.adults === "number" && saved.adults !== travelData.travelers ||
      typeof saved.children === "number" && saved.children !== travelData.children ||
      typeof saved.infants === "number" && saved.infants !== travelData.infants;
    if (!incompatibleCity && !incompatibleArrival && !incompatibleCheckout && !incompatibleTravelers) return;

    setTravelData((current) => current.accommodation?.status === "selected" ? { ...current, accommodation: null } : current);
    try {
      window.localStorage.removeItem("safarino-accommodation-selection-v1");
    } catch {
      // Context still removes the incompatible selection when storage is unavailable.
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
