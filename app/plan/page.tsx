'use client';
import Link from 'next/link';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="w-full max-w-2xl mx-auto mb-8 px-4">
    <div className="flex justify-between mb-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s <= step ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
      <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
  </div>
);

export default function Plan() {
  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-10" dir="rtl">
      <StepIndicator step={5} />
      <div className="max-w-2xl mx-auto bg-gray-900/60 p-8 rounded-3xl border border-gray-800">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-blue-400">برنامه سفر هوشمند</h2>
          <button onClick={() => window.print()} className="bg-gray-800 px-4 py-2 rounded-lg text-sm">🖨️ چاپ PDF</button>
        </div>
        <div className="space-y-4 mb-8 text-right">
           <p className="border-r-2 border-blue-500 pr-4">ساعت ۹:۰۰ - حرکت به سمت مرکز شهر</p>
           <p className="border-r-2 border-blue-500 pr-4">ساعت ۱۲:۰۰ - بازدید از اماکن تاریخی</p>
           <p className="border-r-2 border-blue-500 pr-4">ساعت ۱۴:۰۰ - صرف ناهار در رستوران پیشنهادی</p>
        </div>
        <Link href="/">
          <button className="text-gray-500 hover:text-white transition-colors">بازگشت به شروع</button>
        </Link>
      </div>
    </div>
  );
}