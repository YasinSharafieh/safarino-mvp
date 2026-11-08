'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTravel } from '../context/TravelContext';

const DESTINATIONS = ['شیراز', 'اصفهان', 'کیش', 'رشت', 'یزد'];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mx-auto mb-8 w-full max-w-2xl px-4">
      <div className="mb-2 flex justify-between">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              item <= step
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function QuizPage() {
  const router = useRouter();
  const { travelData, setTravelData } = useTravel();

  const [origin, setOrigin] = useState(travelData.origin || 'تهران');
  const [destination, setDestination] = useState(travelData.destination || 'شیراز');
  const [budget, setBudget] = useState(Number(travelData.budget) || 15);
  const [days, setDays] = useState(Number(travelData.days) || 3);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setTravelData({
      ...travelData,
      origin,
      destination,
      budget,
      days,
    });

    router.push('/transport');
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#070713] p-6 pt-10 text-white">
      <StepIndicator step={2} />

      <div className="mx-auto max-w-xl rounded-3xl border border-gray-800 bg-gray-900/60 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-blue-400">مقصد و بودجه</h1>
          <p className="mt-2 text-sm text-gray-400">اطلاعات اصلی سفر را مشخص کن</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">مبدأ</span>
            <input
              type="text"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="مبدأ (مثلاً تهران)"
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">مقصد</span>
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            >
              {DESTINATIONS.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-4 text-sm font-medium text-gray-300">
              <span>بودجه سفر</span>
              <b className="text-blue-400">{budget.toLocaleString('fa-IR')} میلیون تومان</b>
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              className="w-full cursor-pointer accent-blue-600"
            />
            <span className="mt-2 flex justify-between text-xs text-gray-500">
              <span>۵ میلیون</span>
              <span>۶۰ میلیون</span>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-4 text-sm font-medium text-gray-300">
              <span>مدت سفر</span>
              <b className="text-blue-400">{days.toLocaleString('fa-IR')} روز</b>
            </span>
            <input
              type="range"
              min="1"
              max="7"
              step="1"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="w-full cursor-pointer accent-blue-600"
            />
            <span className="mt-2 flex justify-between text-xs text-gray-500">
              <span>۱ روز</span>
              <span>۷ روز</span>
            </span>
          </label>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-blue-600 py-4 font-bold text-white transition hover:bg-blue-700"
          >
            مرحله بعد: محاسبه هزینه مسیر 🚀
          </button>
        </form>
      </div>
    </main>
  );
}
