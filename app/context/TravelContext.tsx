'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

export interface TravelData {
  origin: string;
  destination: string;
  budget: number;
  days: number;
  vehicle: string;
  transportCost: number;
  accommodationType: string;
  accommodationCost: number;
  tripStyle: string;
}

interface TravelContextType {
  travelData: TravelData;
  setTravelData: React.Dispatch<React.SetStateAction<TravelData>>;
}

const TravelContext = createContext<TravelContextType | any>(null);

export function TravelProvider({ children }: { children: ReactNode }) {
  const [travelData, setTravelData] = useState<TravelData>({
    origin: 'تهران',
    destination: 'شیراز',
    budget: 15,
    days: 3,
    vehicle: '206',
    transportCost: 0,
    accommodationType: 'hotel',
    accommodationCost: 0,
    tripStyle: 'history'
  });

  return (
    <TravelContext.Provider value={{ travelData, setTravelData }}>
      {children}
    </TravelContext.Provider>
  );
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) {
    return {
      travelData: {
        origin: 'تهران',
        destination: 'شیراز',
        budget: 15,
        days: 3,
        vehicle: '206',
        transportCost: 0,
        accommodationType: 'hotel',
        accommodationCost: 0,
        tripStyle: 'history'
      },
      setTravelData: () => {}
    };
  }
  return context;
}
