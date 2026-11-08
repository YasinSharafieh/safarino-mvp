'use client';
import Link from 'next/link';
export default function Home() {
  return (
    <main className="min-h-screen bg-[#070713] text-white flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <h1 className="text-5xl font-bold mb-6 text-blue-400">سفرینو</h1>
      <p className="text-xl mb-12 text-gray-300">برنامه‌ریز هوشمند سفر با هوش مصنوعی</p>
      <Link href="/quiz">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl text-xl font-bold transition-all hover:scale-105">
          شروع طراحی سفر
        </button>
      </Link>
    </main>
  );
}