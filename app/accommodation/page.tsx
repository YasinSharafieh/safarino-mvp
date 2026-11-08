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

interface HotelOption {
  id: number;
  name: string;
  pricePerNight: number;
  type: string;
  rating: string;
}

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
    { id: 1, name: `هتل ۵ ستاره و لوکس ${destination}`, pricePerNight: Math.min(3500000, Math.round(maxNightlyBudget * 0.8)), type: 'hotel', rating: '★ ۴.۸' },
    { id: 2, name: `اقامتگاه بوم‌گردی و سنتی ${destination}`, pricePerNight: Math.min(1200000, Math.round(maxNightlyBudget * 0.4)), type: 'eco', rating: '★ ۴.۶' },
    { id: 3, name: `آپارتمان مجهز و اقتصادی در ${destination}`, pricePerNight: Math.min(1800000, Math.round(maxNightlyBudget * 0.5)), type: 'apartment', rating: '★ ۴.۴' },
  ];

  const currentHotel = hotels.find(h => h.id === selectedHotelId) || hotels[0];
  const totalAccommodationCost = currentHotel.pricePerNight * days;

  const handleNext = () => {
    setTravelData({
      ...travelData,
      accommodationType: currentHotel.type,
      accommodationCost: totalAccommodationCost
    });
    router.push('/plan');
  };

  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={4} />
      <div className="max-w-3xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800 shadow-2xl backdrop-blur-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-blue-400">انتخاب محل اقامت در {destination}</h2>
        
        {/* باکس تحلیل بودجه باقی‌مانده */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 text-center">
            <span className="text-xs text-gray-400 block mb-1">بودجه باقی‌مانده پس از تردد</span>
            <span className="text-lg font-bold text-emerald-400">{(remainingBudget).toLocaleString()} تومان</span>
          </div>
          <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700 text-center">
            <span className="text-xs text-gray-400 block mb-1">سقف بودجه پیشنهادی برای هر شب</span>
            <span className="text-lg font-bold text-blue-400">{(maxNightlyBudget).toLocaleString()} تومان</span>
          </div>
        </div>

        {/* فیلتر نوع اقامتگاه */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
          <button 
            onClick={() => setSelectedType('hotel')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedType === 'hotel' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            هتل‌ها
          </button>
          <button 
            onClick={() => setSelectedType('eco')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedType === 'eco' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
          >
            بوم‌گردی و سنتی
          </button>
        </div>

        {/* کارت‌های هتل */}
        <div className="space-y-4 mb-8">
          {hotels.map((h) => (
            <div 
              key={h.id} 
              onClick={() => setSelectedHotelId(h.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex justify-between items-center ${selectedHotelId === h.id ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/10' : 'bg-gray-800/50 border-gray-700/60 hover:border-gray-600'}`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{h.name}</h3>
                  <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md">{h.rating}</span>
                </div>
                <span className="text-xs text-gray-400">هزینه برای {days} شب: {(h.pricePerNight * days).toLocaleString()} تومان</span>
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-blue-300 mb-2">{h.pricePerNight.toLocaleString()} تومان / شب</span>
                <span className={`text-xs px-3 py-1 rounded-lg font-bold ${selectedHotelId === h.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {selectedHotelId === h.id ? 'انتخاب شده ✓' : 'انتخاب'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all">
          تولید برنامه هوشمند سفر با AI 🎯
        </button>
      </div>
    </div>
  );
}
