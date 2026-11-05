# سفرینو (Safarino) ✈️

اپلیکیشن فارسی برنامه‌ریزی هوشمند سفر با هوش مصنوعی — ساخته‌شده با **Next.js 14 (App Router)** و **Tailwind CSS**.

## امکانات لندینگ

- 🤖 مغز هوشمند سفرینو (AI Travel Brain)
- 🚗 محاسبه دقیق هزینه حمل‌ونقل (بنزین، استهلاک، قطار، پرواز)
- 🏨 پیشنهاد هوشمند اقامتگاه
- 💰 مدیریت و بهینه‌سازی زنده بودجه
- 🗓️ برنامه‌ریزی روزانه و زمان‌بندی هوشمند

## اجرا به‌صورت محلی

```bash
npm install
npm run dev
```

سپس مرورگر را روی <http://localhost:3000> باز کنید.

## ساخت نسخه production

```bash
npm run build
npm start
```

## استقرار روی Vercel

1. به [vercel.com/new](https://vercel.com/new) بروید.
2. ریپوزیتوری `safarino-mvp` را وارد (Import) کنید.
3. بدون هیچ تنظیم اضافه‌ای، **Deploy** را بزنید.

## ساختار پروژه

```
app/
├── layout.tsx     # لایه اصلی، فونت وزیرمتن، dir="rtl"
├── page.tsx       # لندینگ‌پیج سفرینو
└── globals.css    # Tailwind + استایل‌های گلَس‌مورفیزم
tailwind.config.js
postcss.config.js
next.config.js
tsconfig.json
```

---

© ۱۴۰۳ سفرینو
