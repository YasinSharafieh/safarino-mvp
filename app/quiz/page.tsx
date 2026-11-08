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
    <div className="min-h-screen bg-black text-white p-6 pt-10 font-sans" dir="rtl">
      <StepIndicator step={2} />
      <div className="max-w-xl mx-auto bg-[#111] p-8 md:p-10 rounded-3xl border border-[#333] shadow-2xl">
        <h2 className="text-3xl font-black mb-8 text-center text-orange-500 tracking-tight">اطلاعات اولیه سفر</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-3 text-gray-400">مبدا حرکت شما:</label>
            <input 
              type="text" value={origin} onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] focus:border-orange-500 rounded-xl px-5 py-4 text-white outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-3 text-gray-400">مقصد سفر:</label>
            <select 
              value={destination} onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] focus:border-orange-500 rounded-xl px-5 py-4 text-white outline-none transition-colors appearance-none"
            >
              <option value="شیراز">شیراز (فرهنگی و تاریخی)</option>
              <option value="اصفهان">اصفهان (نصف جهان)</option>
              <option value="کیش">جزیره کیش (تفریحی و ساحلی)</option>
              <option value="رشت">رشت و شمال (طبیعت و غذا)</option>
              <option value="یزد">یزد (کویر و معماری)</option>
              <option value="مشهد">مشهد (زیارتی و تاریخی)</option>
            </select>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-sm mb-3 font-bold">
              <span className="text-gray-400">بودجه کل مد نظر:</span>
              <span className="text-orange-500 text-lg">{budget} میلیون تومان</span>
            </div>
            <input 
              type="range" min="5" max="100" value={budget} onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-orange-500 h-2 bg-[#222] rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-sm mb-3 font-bold">
              <span className="text-gray-400">مدت زمان سفر:</span>
              <span className="text-orange-500 text-lg">{days} روز</span>
            </div>
            <input 
              type="range" min="1" max="14" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-orange-500 h-2 bg-[#222] rounded-full appearance-none cursor-pointer"
            />
          </div>

          <div className="pt-6">
            <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] text-lg">
              تایید و ادامه ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}