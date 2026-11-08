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
    <div className="min-h-screen bg-black text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={4} />
      <div className="max-w-3xl mx-auto bg-[#111] p-8 md:p-10 rounded-3xl border border-[#333] shadow-2xl">
        <h2 className="text-3xl font-black mb-6 text-center text-orange-500">انتخاب اقامتگاه</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-[#333] text-center">
            <span className="text-xs text-gray-500 block mb-1 font-bold">بودجه باقی‌مانده پس از تردد</span>
            <span className="text-lg font-black text-white">{(remainingBudget).toLocaleString()} تومان</span>
          </div>
          <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/30 text-center">
            <span className="text-xs text-orange-400 block mb-1 font-bold">سقف مجاز هر شب</span>
            <span className="text-lg font-black text-orange-500">{(maxNightlyBudget).toLocaleString()} تومان</span>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <button onClick={() => setSelectedType('hotel')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedType === 'hotel' ? 'bg-orange-600 text-black' : 'bg-[#1a1a1a] text-gray-400 border border-[#333]'}`}>هتل‌ها</button>
          <button onClick={() => setSelectedType('eco')} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedType === 'eco' ? 'bg-orange-600 text-black' : 'bg-[#1a1a1a] text-gray-400 border border-[#333]'}`}>بوم‌گردی</button>
        </div>

        <div className="space-y-4 mb-10">
          {hotels.map((h) => (
            <div key={h.id} onClick={() => setSelectedHotelId(h.id)} className={`p-5 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${selectedHotelId === h.id ? 'bg-orange-500/10 border-orange-500' : 'bg-[#1a1a1a] border-[#333] hover:border-[#555]'}`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-black text-lg text-white">{h.name}</h3>
                  <span className="text-xs text-black bg-orange-500 px-2 py-0.5 rounded font-bold">{h.rating}</span>
                </div>
                <span className="text-xs text-gray-500 font-bold">مجموع {days} شب: {(h.pricePerNight * days).toLocaleString()} تومان</span>
              </div>
              <div className="text-left">
                <span className={`block text-sm font-black mb-2 ${selectedHotelId === h.id ? 'text-orange-500' : 'text-gray-300'}`}>{h.pricePerNight.toLocaleString()} تومان / شب</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleNext} className="w-full bg-orange-600 hover:bg-orange-500 text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all hover:scale-[1.02] text-lg">
          دریافت برنامه هوشمند سفر ➔
        </button>
      </div>
    </div>
  );
}