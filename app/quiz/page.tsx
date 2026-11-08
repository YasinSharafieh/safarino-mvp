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

export default function Quiz() {
  const { travelData, setTravelData } = useTravel();
  const router = useRouter();

  const [origin, setOrigin] = useState<string>(travelData?.origin || 'تهران');
  const [destination, setDestination] = useState<string>(travelData?.destination || 'شیراز');
  const [budget, setBudget] = useState<number>(travelData?.budget || 15);
  const [days, setDays] = useState<number>(travelData?.days || 3);

  const handleNext = () => {
    setTravelData({ ...travelData, origin, destination, budget, days });
    router.push('/transport');
  };

  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={2} />
      <div className="max-w-xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">مقصد و مشخصات سفر</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">مبدا حرکت:</label>
            <input 
              type="text" 
              value={origin} 
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">مقصد سفر:</label>
            <select 
              value={destination} 
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="شیراز">شیراز (فرهنگی و تاریخی)</option>
              <option value="اصفهان">اصفهان (نصف جهان)</option>
              <option value="کیش">جزیره کیش (تفریحی و ساحلی)</option>
              <option value="رشت">رشت و شمال (طبیعت و غذا)</option>
              <option value="یزد">یزد (کویر و معماری)</option>
              <option value="مشهد">مشهد (زیارتی و تاریخی)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-300">کل بودجه مد نظر:</span>
              <span className="text-blue-400 font-bold">{budget} میلیون تومان</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="60" 
              value={budget} 
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-300">مدت زمان سفر:</span>
              <span className="text-blue-400 font-bold">{days} روز</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="7" 
              value={days} 
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="block pt-4">
            <button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all">
              مرحله بعد: محاسبه هزینه مسیر 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
