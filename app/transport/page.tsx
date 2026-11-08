'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTravel } from '../context/TravelContext';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-8 px-4">
    <div className="flex justify-between mb-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${s <= step ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
    <div className="flex justify-between mt-2 text-[11px] text-gray-400 text-center font-medium">
      <span className={step >= 1 ? "text-blue-400 font-bold" : ""}>شروع</span>
      <span className={step >= 2 ? "text-blue-400 font-bold" : ""}>مقصد و بودجه</span>
      <span className={step >= 3 ? "text-blue-400 font-bold" : ""}>حمل و نقل</span>
      <span className={step >= 4 ? "text-blue-400 font-bold" : ""}>اقامتگاه</span>
      <span className={step >= 5 ? "text-blue-400 font-bold" : ""}>برنامه سفر</span>
    </div>
  </div>
);

const getDistance = (origin: string, destination: string): number => {
  const distances: Record<string, number> = {
    'تهران-شیراز': 1860,
    'تهران-اصفهان': 900,
    'تهران-کیش': 2500,
    'تهران-رشت': 640,
    'تهران-یزد': 1240,
    'تهران-مشهد': 1800,
    'تبریز-کیش': 3100,
    'تبریز-شیراز': 2800,
    'اصفهان-شیراز': 960,
  };
  const key1 = `${origin}-${destination}`;
  const key2 = `${destination}-${origin}`;
  return distances[key1] || distances[key2] || 1200;
};

interface CarInfo {
  name: string;
  fuelPer100: number;
  depPerKm: number;
}

export default function Transport() {
  const { travelData, setTravelData } = useTravel();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<string>(travelData?.vehicle || '206');

  const origin = travelData?.origin || 'تهران';
  const destination = travelData?.destination || 'شیراز';
  const totalDistance = getDistance(origin, destination);

  const carData: Record<string, CarInfo> = {
    'pride': { name: 'پراید', fuelPer100: 6.5, depPerKm: 1500 },
    '206': { name: 'پژو ۲۰۶ / ۲۰۷', fuelPer100: 7.2, depPerKm: 2200 },
    'samand': { name: 'سمند / پژو پارس', fuelPer100: 8.5, depPerKm: 2500 },
    'dena': { name: 'دنا / دنا پلاس', fuelPer100: 7.8, depPerKm: 2800 },
    'haima': { name: 'هایما S7 / شاسی بلند', fuelPer100: 9.5, depPerKm: 4500 },
  };

  const currentCar = carData[vehicle] || carData['206'];
  const fuelCost = Math.round(((totalDistance * currentCar.fuelPer100) / 100) * 3000);
  const depCost = totalDistance * currentCar.depPerKm;
  const totalTransportCost = fuelCost + depCost;

  const handleNext = () => {
    setTravelData({ 
      ...travelData, 
      vehicle, 
      transportCost: totalTransportCost 
    });
    router.push('/accommodation');
  };

  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={3} />
      <div className="max-w-2xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-blue-400">محاسبه هزینه‌های رفت و برگشت</h2>
        <p className="text-center text-xs text-gray-400 mb-6">مسیر: {origin} به {destination} (حدود {totalDistance} کیلومتر رفت و برگشت)</p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-300">خودروی شخصی خود را انتخاب کنید:</label>
          <select 
            value={vehicle} 
            onChange={(e) => setVehicle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="pride">پراید (کم‌مصرف)</option>
            <option value="206">پژو ۲۰۶ / ۲۰۷</option>
            <option value="samand">سمند / پژو پارس / ۴۰۵</option>
            <option value="dena">دنا / دنا پلاس</option>
            <option value="haima">هایما S7 / شاسی بلند</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 text-center">
            <span className="text-xs text-gray-400 block mb-1">هزینه بنزین (آزاد)</span>
            <span className="text-lg font-bold text-emerald-400">{(fuelCost).toLocaleString()} تومان</span>
          </div>
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 text-center">
            <span className="text-xs text-gray-400 block mb-1">استهلاک و عوارضی</span>
            <span className="text-lg font-bold text-amber-400">{(depCost).toLocaleString()} تومان</span>
          </div>
          <div className="bg-blue-900/30 p-4 rounded-2xl border border-blue-500/30 text-center">
            <span className="text-xs text-blue-300 block mb-1">جمع کل رفت و برگشت</span>
            <span className="text-lg font-bold text-blue-400">{(totalTransportCost).toLocaleString()} تومان</span>
          </div>
        </div>

        <button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all">
          مرحله بعد: انتخاب اقامتگاه 🏨
        </button>
      </div>
    </div>
  );
}
