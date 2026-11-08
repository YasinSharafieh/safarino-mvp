'use client';
import Link from 'next/link';


const StepIndicator = ({ step }) => (
  <div className="w-full max-w-xl mx-auto mb-8 px-4">
    <div className="flex justify-between mb-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${s <= step ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
          {s}
        </div>
      ))}
    </div>
    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
      <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
    </div>
    <div className="flex justify-between mt-1 text-[10px] text-gray-400 text-center leading-tight">
      <span className="w-12">شروع</span><span className="w-12">مقصد</span><span className="w-12">تردد</span><span className="w-12">هتل</span><span className="w-12">برنامه</span>
    </div>
  </div>
);


export default function Page() {
  return (
    <div className="min-h-screen bg-[#070713] text-white p-6 pt-12" dir="rtl">
      <StepIndicator step={5} />
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-8">برنامه سفر شما</h1>
        <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700 mb-8 text-right">
           <p className="mb-4 text-gray-300">برنامه ساعتی سفر به همراه نقشه و توصیه‌های هوش مصنوعی.</p>
        </div>
        <button onClick={() => window.print()} className="bg-blue-600 w-full py-4 rounded-xl font-bold">چاپ و دریافت PDF</button>
        <div className="mt-4"><Link href="/" className="text-gray-500">بازگشت به خانه</Link></div>
      </div>
    </div>
  );
}