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
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-10 font-sans relative overflow-hidden" dir="rtl">
      {/* هاله‌های نور پس‌زمینه */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <StepIndicator step={2} />
      
      <div className="max-w-xl mx-auto bg-[#111111]/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl relative z-10">
        <h2 className="text-3xl font-extrabold mb-8 text-center bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">اطلاعات اولیه سفر</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-3 text-gray-300">مبدا حرکت شما:</label>
            <input 
              type="text" value={origin} onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-black/50 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-2xl px-5 py-4 text-white outline-none transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 text-gray-300">مقصد سفر:</label>
            <select 
              value={destination} onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-black/50 border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-2xl px-5 py-4 text-white outline-none transition-all appearance-none"
            >
              <option value="شیراز">شیراز (فرهنگی و تاریخی)</option>
              <option value="اصفهان">اصفهان (نصف جهان)</option>
              <option value="کیش">جزیره کیش (تفریحی و ساحلی)</option>
              <option value="رشت">رشت و شمال (طبیعت و غذا)</option>
              <option value="یزد">یزد (کویر و معماری)</option>
              <option value="مشهد">مشهد (زیارتی و تاریخی)</option>
            </select>
          </div>

          <div className="pt-4">
            <div className="flex justify-between text-sm mb-4 font-semibold">
              <span className="text-gray-300">بودجه کل مد نظر:</span>
              <span className="text-orange-400 text-lg font-bold">{budget} میلیون تومان</span>
            </div>
            <input 
              type="range" min="5" max="100" value={budget} onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-orange-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="pt-4">
            <div className="flex justify-between text-sm mb-4 font-semibold">
              <span className="text-gray-300">مدت زمان سفر:</span>
              <span className="text-orange-400 text-lg font-bold">{days} روز</span>
            </div>
            <input 
              type="range" min="1" max="14" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-orange-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="pt-8">
            <button onClick={handleNext} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-extrabold py-4 rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] active:scale-95 text-lg">
              تایید و ادامه مسیر ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}