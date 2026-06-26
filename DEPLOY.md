# 🚀 Deploying Image-to-URL on Vercel (Free Tier)

This project is split into **two Vercel projects** — one for the backend (Express API) and one for the frontend (Next.js).

---

## Prerequisites

- A GitHub account
- A Vercel account (sign up free at [vercel.com](https://vercel.com))
- Your Google OAuth2 credentials ready:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
  - `GOOGLE_DRIVE_FOLDER_ID`

---

## Step 1 — Push to GitHub

```bash
cd Image_to_url
git init
git add .
git commit -m "Initial commit: Image-to-URL with Google Drive"
git remote add origin https://github.com/YOUR_USERNAME/Image_to_url.git
git push -u origin main
```

---

## Step 2 — Deploy the Backend

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your `Image_to_url` repo
3. Set **Root Directory** to: `backend`
4. Framework Preset: **Other**
5. Click **Environment Variables** and add these 4 keys:

   | Key | Value |
   |-----|-------|
   | `GOOGLE_CLIENT_ID` | `912596897026-xxxxx.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` |
   | `GOOGLE_REFRESH_TOKEN` | `1//04xxxxx` |
   | `GOOGLE_DRIVE_FOLDER_ID` | `1Uy5Pdn1t8Ra...` |

6. Click **Deploy**
7. Once deployed, copy the URL (e.g., `https://image-to-url-backend.vercel.app`)

---

## Step 3 — Deploy the Frontend

1. Go to [vercel.com/new](https://vercel.com/new) again
2. Import the **same** `Image_to_url` repo
3. Set **Root Directory** to: `frontend`
4. Framework Preset: **Next.js** (should auto-detect)
5. Click **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://image-to-url-backend.vercel.app` ← your backend URL from Step 2 |

6. Click **Deploy**

---

## Step 4 — Connect CORS

Go back to your **backend** project on Vercel:

1. Navigate to **Settings** → **Environment Variables**
2. Add a new variable:

   | Key | Value |
   |-----|-------|
   | `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` ← your frontend URL from Step 3 |

3. **Redeploy** the backend (Deployments → 3-dot menu → Redeploy)

---

## ✅ Done!

Your app is live:
- **Frontend**: `https://your-frontend.vercel.app`
- **Backend API**: `https://your-backend.vercel.app/api/v1/upload`

---

## Important Notes

> [!WARNING]
> **Vercel Free Tier has a 4.5MB request body limit.** Files larger than ~4.5MB will be rejected. The frontend and backend are already configured for this.

> [!TIP]
> **Never commit `.env` files to Git.** The `.gitignore` already excludes them. All secrets go into the Vercel dashboard.

> [!NOTE]
> **Serverless cold starts:** The first request after inactivity may take 1-3 seconds. This is normal on Vercel's free tier.
