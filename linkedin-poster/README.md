# LinkedIn AI Poster — Vercel Deployment Guide

## What this is
A Next.js app that generates LinkedIn posts using Claude AI and posts them directly to LinkedIn via Zapier — with true one-click posting (no CORS issues).

---

## Step 1 — Get your Anthropic API Key
1. Go to https://console.anthropic.com
2. Click **API Keys** → **Create Key**
3. Copy the key — you'll need it in Step 4

---

## Step 2 — Upload to GitHub
1. Go to https://github.com → click **New repository**
2. Name it `linkedin-ai-poster` → click **Create**
3. Upload all these files to the repo (drag and drop into GitHub)

---

## Step 3 — Deploy to Vercel
1. Go to https://vercel.com → sign up free with GitHub
2. Click **Add New Project**
3. Select your `linkedin-ai-poster` repo
4. Click **Deploy** — Vercel auto-detects Next.js

---

## Step 4 — Add Environment Variables in Vercel
1. In Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add these two:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | your key from Step 1 |
| `ZAPIER_WEBHOOK_URL` | `https://hooks.zapier.com/hooks/catch/27138989/4yrhxgt/` |

3. Click **Save** → go to **Deployments** → **Redeploy**

---

## Step 5 — Open your app
Your app is live at: `https://linkedin-ai-poster.vercel.app`

Bookmark it — this is your permanent LinkedIn posting tool!

---

## How it works
```
You type topic
    → Vercel server calls Claude API (no CORS)
    → Post generated
    → Click "Post to LinkedIn Now"
    → Vercel server calls Zapier webhook (no CORS)
    → Zapier posts to LinkedIn ✅
```

---

## Costs
- Vercel: **Free**
- Anthropic API: ~$0.003 per post (~$0.30 for 100 posts)
- Zapier: **Free** (up to 100 tasks/month)
