# ✈️ سفرینو | Safarino

> پلتفرم مدرن رزرو سفر ایرانی — ساخته‌شده با **Next.js 14 (App Router)** و **Tailwind CSS**

![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)
![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript)
![RTL](https://img.shields.io/badge/Layout-RTL%20%2F%20فارسی-22c55e?style=flat-square)

---

## 🧭 دربارهٔ پروژه

**سفرینو** یک لندینگ‌پیج کامل و راست‌چین برای یک پلتفرم رزرو پرواز، هتل و تور است.
طراحی بر پایهٔ **تم تیره**، **افکت Glassmorphism**، **گرید بنتو (Bento Grid)** و انیمیشن‌های
نرم با **Framer Motion** پیاده‌سازی شده است.

## ⚙️ تکنولوژی‌ها

| ابزار | کاربرد |
| --- | --- |
| Next.js 14 (App Router) | ساختار صفحه و رندر سمت سرور |
| Tailwind CSS | استایل‌دهی یوتیلیتی با تم سفارشی |
| Framer Motion | انیمیشن‌های ورود، پارالاکس و تعامل |
| lucide-react | آیکون‌های SVG سبک و مدرن |
| Vazirmatn | فونت فارسی استاندارد وب |

## 🚀 اجرا

```bash
npm install
npm run dev
```

سپس مرورگر را روی <http://localhost:3000> باز کنید.

## 📁 ساختار

```
.
├── app/
│   ├── globals.css     # تم تیره، افکت شیشه‌ای، اسکرول‌بار سفارشی
│   ├── layout.tsx      # RTL، فونت وزیرمتن، متادیتای فارسی
│   └── page.tsx        # لندینگ‌پیج کامل سفرینو
├── tailwind.config.js  # تم رنگی سفارشی (night / saffron / turquoise)
├── postcss.config.js
├── next.config.mjs
└── tsconfig.json
```

## ✨ بخش‌های صفحه

- 🧭 **هدر شیشه‌ای چسبان** با منوی واکنش‌گرا
- 🎯 **هیرو** با پس‌زمینهٔ آرورا و جعبهٔ جست‌وجوی سه‌حالته (پرواز / هتل / تور)
- 📊 **نوار آمار** با انیمیشن ورود
- 🧩 **گرید بنتو** خدمات با کارت‌های هم‌پوشان و سایز متفاوت
- 🗺️ **مقاصد محبوب** با کارت‌های گرادیانی و قیمت
- 💡 **بخش چرا سفرینو** همراه نمودار بودجه
- ⭐ **نظرات مسافران** و **سؤالات متداول** آکاردئونی
- 📣 **کال‌تو‌اکشن** نهایی با کد تخفیف و فوتر کامل

## 🤖 استقرار خودکار

این مخزن با اسکریپت پایتونی `deploy_safarino.py` ساخته شده است:

```bash
export GITHUB_TOKEN="ghp_xxx"
python deploy_safarino.py
```

---

ساخته‌شده با ❤️ برای جامعهٔ توسعه‌دهندگان ایرانی.
