'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTravel } from '../context/TravelContext';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-10 px-4">
    <div className="flex justify-between mb-3">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold transition-all duration-300 ${s <= step ? 'bg-orange-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-110' : 'bg-[#1a1a1a] text-gray-500 border border-[#333]'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden border border-[#333]">
      <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
    <div className="flex justify-between mt-3 text-[11px] text-gray-500 text-center font-bold">
      <span className={step >= 1 ? "text-orange-500" : ""}>شروع</span>
      <span className={step >= 2 ? "text-orange-500" : ""}>مقصد و بودجه</span>
      <span className={step >= 3 ? "text-orange-500" : ""}>حمل و نقل</span>
      <span className={step >= 4 ? "text-orange-500" : ""}>اقامتگاه</span>
      <span className={step >= 5 ? "text-orange-500" : ""}>برنامه سفر</span>
    </div>
  </div>
);


const getDistance = (origin: string, destination: string): number => {
  const distances: Record<string, number> = {
    'تهران-شیراز': 1860, 'تهران-اصفهان': 900, 'تهران-کیش': 2500, 'تهران-رشت': 640,
    'تهران-یزد': 1240, 'تهران-مشهد': 1800, 'تبریز-کیش': 3100, 'تبریز-شیراز': 2800,
    'اصفهان-شیراز': 960,
  };
  const key1 = `${origin}-${destination}`;
  const key2 = `${destination}-${origin}`;
  return distances[key1] || distances[key2] || 1200;
};

interface CarInfo { name: string; fuelPer100: number; depPerKm: number; }

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
    'samand': { name: 'سمند / پارس', fuelPer100: 8.5, depPerKm: 2500 },
    'dena': { name: 'دنا پلاس', fuelPer100: 7.8, depPerKm: 2800 },
    'haima': { name: 'شاسی بلند', fuelPer100: 9.5, depPerKm: 4500 },
  };

  const currentCar = carData[vehicle] || carData['206'];
  const fuelCost = Math.round(((totalDistance * currentCar.fuelPer100) / 100) * 3000);
  const depCost = totalDistance * currentCar.depPerKm;
  const totalTransportCost = fuelCost + depCost;

  const handleNext = () => {
    setTravelData({ ...travelData, vehicle, transportCost: totalTransportCost });
    router.push('/accommodation');
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={3} />
      <div className="max-w-2xl mx-auto bg-[#111] p-8 md:p-10 rounded-3xl border border-[#333] shadow-2xl">
        <h2 className="text-3xl font-black mb-2 text-center text-orange-500">هزینه مسیر و خودرو</h2>
        <p className="text-center text-sm text-gray-500 mb-8 font-bold">مسیر: {origin} به {destination} (حدود {totalDistance} کیلومتر رفت‌وبرگشت)</p>
        
        <div className="mb-8">
          <label className="block text-sm font-bold mb-3 text-gray-400">انتخاب خودروی شخصی:</label>
          <select 
            value={vehicle} onChange={(e) => setVehicle(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] focus:border-orange-500 rounded-xl px-5 py-4 text-white outline-none transition-colors"
          >
            <option value="pride">پراید (اقتصادی)</option>
            <option value="206">پژو ۲۰۶ / ۲۰۷</option>
            <option value="samand">سمند / پژو پارس</option>
            <option value="dena">دنا / دنا پلاس</option>
            <option value="haima">شاسی بلند (مصرف بالا)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-[#333] text-center">
            <span className="text-xs text-gray-500 block mb-2 font-bold">بنزین (آزاد)</span>
            <span className="text-lg font-black text-white">{(fuelCost).toLocaleString()} <span className="text-xs">تومان</span></span>
          </div>
          <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-[#333] text-center">
            <span className="text-xs text-gray-500 block mb-2 font-bold">استهلاک و عوارض</span>
            <span className="text-lg font-black text-white">{(depCost).toLocaleString()} <span className="text-xs">تومان</span></span>
          </div>
          <div className="bg-orange-500/10 p-5 rounded-2xl border border-orange-500/30 text-center">
            <span className="text-xs text-orange-400 block mb-2 font-bold">جمع هزینه مسیر</span>
            <span className="text-xl font-black text-orange-500">{(totalTransportCost).toLocaleString()} <span className="text-xs">تومان</span></span>
          </div>
        </div>

        <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] text-lg">
          تایید و ادامه ➔
        </button>
      </div>
    </div>
  );
}