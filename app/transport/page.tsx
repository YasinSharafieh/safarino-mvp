'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTravel } from '../context/TravelContext';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-12 px-4 relative z-10">
    <div className="flex justify-between mb-4">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${s <= step ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] scale-110' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 h-full transition-all duration-700 ease-out" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
    <div className="flex justify-between mt-3 text-[11px] text-gray-400 text-center font-medium tracking-wide">
      <span className={step >= 1 ? "text-orange-400 font-bold" : ""}>شروع</span>
      <span className={step >= 2 ? "text-orange-400 font-bold" : ""}>مقصد و بودجه</span>
      <span className={step >= 3 ? "text-orange-400 font-bold" : ""}>حمل و نقل</span>
      <span className={step >= 4 ? "text-orange-400 font-bold" : ""}>اقامتگاه</span>
      <span className={step >= 5 ? "text-orange-400 font-bold" : ""}>برنامه سفر</span>
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
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-10 relative overflow-hidden" dir="rtl">
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <StepIndicator step={3} />
      
      <div className="max-w-2xl mx-auto bg-[#111111]/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl relative z-10">
        <h2 className="text-3xl font-extrabold mb-3 text-center bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">هزینه مسیر و خودرو</h2>
        <p className="text-center text-sm text-gray-400 mb-8 font-medium bg-white/5 inline-block mx-auto px-4 py-1.5 rounded-full border border-white/10">مسیر: {origin} به {destination} <span className="text-orange-400">({totalDistance} کیلومتر)</span></p>
        
        <div className="mb-10">
          <label className="block text-sm font-semibold mb-3 text-gray-300">انتخاب خودروی شخصی:</label>
          <select 
            value={vehicle} onChange={(e) => setVehicle(e.target.value)}
            className="w-full bg-black/50 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-2xl px-5 py-4 text-white outline-none transition-all"
          >
            <option value="pride">پراید (اقتصادی)</option>
            <option value="206">پژو ۲۰۶ / ۲۰۷</option>
            <option value="samand">سمند / پژو پارس</option>
            <option value="dena">دنا / دنا پلاس</option>
            <option value="haima">شاسی بلند (مصرف بالا)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center shadow-inner">
            <span className="text-xs text-gray-400 block mb-2 font-medium">بنزین (آزاد)</span>
            <span className="text-xl font-bold text-white">{(fuelCost).toLocaleString()} <span className="text-xs text-gray-500">تومان</span></span>
          </div>
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center shadow-inner">
            <span className="text-xs text-gray-400 block mb-2 font-medium">استهلاک و عوارض</span>
            <span className="text-xl font-bold text-white">{(depCost).toLocaleString()} <span className="text-xs text-gray-500">تومان</span></span>
          </div>
          <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/5 p-5 rounded-2xl border border-orange-500/30 text-center shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-400"></div>
            <span className="text-xs text-orange-300 block mb-2 font-bold">جمع هزینه مسیر</span>
            <span className="text-2xl font-black text-orange-400">{(totalTransportCost).toLocaleString()} <span className="text-xs text-orange-500/50">تومان</span></span>
          </div>
        </div>

        <button onClick={handleNext} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-extrabold py-4 rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] active:scale-95 text-lg">
          تایید و ادامه مسیر ➔
        </button>
      </div>
    </div>
  );
}