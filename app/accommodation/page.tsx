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

interface HotelOption { id: number; name: string; pricePerNight: number; type: string; rating: string; }

export default function Accommodation() {
  const { travelData, setTravelData } = useTravel();
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<string>(travelData?.accommodationType || 'hotel');
  const [selectedHotelId, setSelectedHotelId] = useState<number>(1);

  const destination = travelData?.destination || 'شیراز';
  const totalBudgetToman = (travelData?.budget || 15) * 1000000;
  const transportCost = travelData?.transportCost || 1800000;
  const days = travelData?.days || 3;

  const remainingBudget = Math.max(0, totalBudgetToman - transportCost);
  const maxNightlyBudget = Math.round(remainingBudget / days);

  const hotels: HotelOption[] = [
    { id: 1, name: `هتل لوکس ${destination}`, pricePerNight: Math.min(3500000, Math.round(maxNightlyBudget * 0.8)), type: 'hotel', rating: '★ ۴.۸' },
    { id: 2, name: `بوم‌گردی سنتی ${destination}`, pricePerNight: Math.min(1200000, Math.round(maxNightlyBudget * 0.4)), type: 'eco', rating: '★ ۴.۶' },
    { id: 3, name: `آپارتمان اقتصادی ${destination}`, pricePerNight: Math.min(1800000, Math.round(maxNightlyBudget * 0.5)), type: 'apartment', rating: '★ ۴.۴' },
  ];

  const currentHotel = hotels.find(h => h.id === selectedHotelId) || hotels[0];
  const totalAccommodationCost = currentHotel.pricePerNight * days;

  const handleNext = () => {
    setTravelData({ ...travelData, accommodationType: currentHotel.type, accommodationCost: totalAccommodationCost });
    router.push('/plan');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 pt-10 relative overflow-hidden" dir="rtl">
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <StepIndicator step={4} />
      
      <div className="max-w-3xl mx-auto bg-[#111111]/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl relative z-10">
        <h2 className="text-3xl font-extrabold mb-8 text-center bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">انتخاب اقامتگاه</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center shadow-inner">
            <span className="text-xs text-gray-400 block mb-2 font-medium">بودجه باقی‌مانده پس از تردد</span>
            <span className="text-xl font-bold text-white">{(remainingBudget).toLocaleString()} <span className="text-xs text-gray-500">تومان</span></span>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-transparent p-5 rounded-2xl border border-orange-500/20 text-center">
            <span className="text-xs text-orange-400 block mb-2 font-bold">سقف مجاز هر شب</span>
            <span className="text-xl font-bold text-orange-400">{(maxNightlyBudget).toLocaleString()} <span className="text-xs">تومان</span></span>
          </div>
        </div>

        <div className="flex gap-3 mb-8 border-b border-white/5 pb-6">
          <button onClick={() => setSelectedType('hotel')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${selectedType === 'hotel' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-black/40 text-gray-400 border border-white/5 hover:border-white/10'}`}>هتل‌ها</button>
          <button onClick={() => setSelectedType('eco')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${selectedType === 'eco' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-black/40 text-gray-400 border border-white/5 hover:border-white/10'}`}>بوم‌گردی</button>
        </div>

        <div className="space-y-4 mb-10">
          {hotels.map((h) => (
            <div key={h.id} onClick={() => setSelectedHotelId(h.id)} className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 flex justify-between items-center ${selectedHotelId === h.id ? 'bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.1)] scale-[1.01]' : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-white/[0.02]'}`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={`font-bold text-lg ${selectedHotelId === h.id ? 'text-orange-400' : 'text-white'}`}>{h.name}</h3>
                  <span className="text-[10px] text-black bg-gradient-to-r from-orange-400 to-amber-400 px-2 py-1 rounded font-bold">{h.rating}</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">مجموع {days} شب: {(h.pricePerNight * days).toLocaleString()} تومان</span>
              </div>
              <div className="text-left">
                <span className={`block text-sm font-extrabold mb-2 ${selectedHotelId === h.id ? 'text-orange-400' : 'text-gray-300'}`}>{h.pricePerNight.toLocaleString()} تومان / شب</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleNext} className="w-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-extrabold py-4 rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] active:scale-95 text-lg">
          دریافت برنامه هوشمند سفر ➔
        </button>
      </div>
    </div>
  );
}