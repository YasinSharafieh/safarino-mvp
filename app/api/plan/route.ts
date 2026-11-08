import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { origin, destination, budget, days, vehicle, transportCost, accommodationCost } = body;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        title: `برنامه سفر اختصاصی ${destination}`,
        summary: `برنامه پیشنهادی سفر از ${origin} به ${destination} برای ${days} روز`,
        itinerary: [
          { day: 1, time: '۰۹:۰۰ - ۱۱:۰۰', activity: `حرکت از ${origin} به سمت ${destination}`, cost: `${(transportCost || 0).toLocaleString()} تومان` },
          { day: 1, time: '۱۳:۰۰ - ۱۴:۳۰', activity: 'صرف ناهار در رستوران سنتی و تحویل اقامتگاه', cost: '۳۵۰,۰۰۰ تومان' },
          { day: 1, time: '۱۶:۳۰ - ۱۹:۰۰', activity: 'بازدید از جاذبه‌های تاریخی و گردشگری اصلی شهر', cost: '۱۰۰,۰۰۰ تومان' },
          { day: 2, time: '۱۰:۰۰ - ۱۳:۰۰', activity: 'گشت و گذار در بازار سنتی و خرید سوغات', cost: 'دلنخواه' },
          { day: 2, time: '۱۸:۰۰ - ۲۱:۰۰', activity: 'پیاده‌روی و صرف شام در جاذبه‌های معروف شهر', cost: '۲۵۰,۰۰۰ تومان' }
        ],
        aiTips: [
          'بهترین زمان بازدید از جاذبه‌های روباز صبح زود یا غروب آفتاب است.',
          'بلیط‌های ورودی اماکن دیدنی را از قبل اینترنتی تهیه کنید.'
        ]
      });
    }

    const prompt = `یک برنامه سفر ${days} روزه واقعی از مبدا ${origin} به مقصد ${destination} بنویس.
بودجه کل: ${budget} میلیون تومان.
وسیله نقلیه: ${vehicle} (هزینه رفت و برگشت: ${transportCost} تومان).
هزینه اقامت: ${accommodationCost} تومان.

پاسخ را دقیقا به فرمت JSON زیر بده بدون هیچ کلمه اضافی:
{
  "title": "برنامه سفر ${destination}",
  "summary": "خلاصه ۱ جمله‌ای جذاب از این سفر",
  "itinerary": [
    {"day": 1, "time": "09:00 - 11:00", "activity": "عنوان دقیق جاذبه یا فعالیت در ${destination}", "cost": "هزینه تقریبی"},
    {"day": 1, "time": "12:00 - 14:00", "activity": "عنوان فعالیت بعدی", "cost": "هزینه تقریبی"},
    {"day": 1, "time": "16:00 - 19:00", "activity": "عنوان فعالیت عصر", "cost": "هزینه تقریبی"},
    {"day": 2, "time": "10:00 - 13:00", "activity": "برنامه روز دوم", "cost": "هزینه تقریبی"}
  ],
  "aiTips": [
    "توصیه محلی اول برای سفر به ${destination}",
    "توصیه دوم در مورد مدیریت بودجه یا مسیرها"
  ]
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://safarino-mvp.netlify.app',
        'X-Title': 'Safarino MVP'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7
      })
    });

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json(parsedData);
  } catch (error) {
    return NextResponse.json({
      title: 'برنامه سفر پیشنهادی سفرینو',
      summary: 'برنامه هوشمند تنظیم شده بر اساس اطلاعات ورودی شما',
      itinerary: [
        { day: 1, time: '۰۹:۰۰ - ۱۲:۰۰', activity: 'شروع مسیر و ورود به شهر مقصد', cost: 'طبق محاسبات' },
        { day: 1, time: '۱۳:۰۰ - ۱۵:۰۰', activity: 'تحویل اقامتگاه و استراحت', cost: 'رایگان' },
        { day: 1, time: '۱۷:۰۰ - ۲۰:۰۰', activity: 'بازدید از معروف‌ترین جاذبه تاریخی شهر', cost: '۸۰,۰۰۰ تومان' }
      ],
      aiTips: ['قبل از حرکت از سلامت فنی خودرو مطمئن شوید.']
    });
  }
}
