# Mindly — Deployment Guide

## Prerequisites
- Node.js 18+
- A Supabase project
- A Groq API key (free at console.groq.com)
- A Razorpay account (India)
- A Resend account (free tier OK for start)

---

## 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the full schema in **SQL Editor**:
   - Open `supabase/schema.sql`
   - Paste & execute the entire file
3. Enable **Email Auth** in Authentication → Providers
4. Enable **Google OAuth**:
   - Authentication → Providers → Google
   - Add your Google Client ID & Secret
   - Set redirect URL: `https://yourdomain.com/auth/callback`
5. Copy your **Project URL** and **Anon Key** from Settings → API

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

| Variable | Where to get it |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `GROQ_API_KEY` | console.groq.com |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Dashboard → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Your verified domain email |
| `NEXT_PUBLIC_APP_URL` | Your production URL |
| `CRON_SECRET` | Any random 32-char string |

---

## 3. Local Development

```bash
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## 4. Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo in the Vercel dashboard.

**Add all environment variables** in Vercel → Project → Settings → Environment Variables.

### Vercel Cron Jobs (for weekly emails)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/weekly-email",
      "schedule": "0 9 * * 0"
    },
    {
      "path": "/api/notifications/send",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

## 5. Razorpay Webhook Setup

1. Razorpay Dashboard → Webhooks → Add New
2. URL: `https://yourdomain.com/api/payments/webhook`
3. Events: `payment.captured`, `payment.failed`
4. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`

---

## 6. Row Level Security

RLS is already configured in `supabase/schema.sql`. All tables are secured — users can only read/write their own data. Institution admins can read their students' data.

---

## 7. Production Checklist

- [ ] All env vars set in Vercel/hosting
- [ ] Supabase schema applied
- [ ] Google OAuth redirect URL updated to production domain
- [ ] Razorpay webhook pointing to production URL
- [ ] `RESEND_FROM_EMAIL` using a verified domain (not gmail)
- [ ] `NEXT_PUBLIC_APP_URL` set to production URL
- [ ] Test payment flow in Razorpay test mode first

---

## App Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/signup` | Email signup |
| `/auth/login` | Email login |
| `/auth/phone` | Phone OTP login |
| `/onboarding` | 5-step setup wizard |
| `/dashboard` | Main dashboard |
| `/roadmap` | AI study roadmap |
| `/flashcards` | Flashcard review (SM-2) |
| `/quiz` | AI quiz engine |
| `/chat` | AI tutor chat |
| `/analytics` | Progress & readiness |
| `/profile` | User profile |
| `/upgrade` | Pricing & payments |
| `/admin` | Institution admin panel |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/roadmap/generate` | POST | Generate AI roadmap |
| `/api/roadmap/adjust` | POST | Adjust roadmap pacing |
| `/api/flashcards/generate` | POST | Generate 20 flashcards |
| `/api/flashcards/review` | GET/POST | Due cards / SM-2 update |
| `/api/quiz/generate` | POST | Generate MCQ questions |
| `/api/quiz/submit` | POST | Submit quiz + award XP |
| `/api/chat` | GET/POST | AI tutor streaming chat |
| `/api/analytics/readiness` | GET | AI readiness score |
| `/api/dashboard/stats` | GET | Dashboard stats |
| `/api/payments/create-order` | POST | Razorpay order |
| `/api/payments/webhook` | POST | Razorpay webhook |
| `/api/gamification/badge` | POST | Award badge |
| `/api/notifications/subscribe` | POST | Push notification sub |
| `/api/notifications/send` | POST | Send push (cron) |
| `/api/notifications/weekly-email` | POST | Weekly digest (cron) |
| `/api/admin/stats` | GET | Institution stats |
| `/api/admin/students` | GET | Student list |
| `/api/profile` | GET/PATCH | User profile |
