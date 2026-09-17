# Reptura — Deployment Guide
PWA (Add to Home Screen) version for iOS/Android

---

## What You're Deploying

| Part     | Where          | Cost    |
|----------|----------------|---------|
| Backend  | Railway        | Free    |
| Database | Railway MySQL  | Free    |
| Frontend | Netlify        | Free    |

When done, Reptura will be live at a real URL. You and friends can open it in Safari, tap **Share → Add to Home Screen**, and it launches like a native app with its own icon.

---

## PHASE 1 — Deploy the Backend (Railway)

### Step 1 — Push your code to GitLab (you already have this)

Make sure your latest code is pushed to `https://gitlab.com/TysonMartin203/fittrack-capstone`

### Step 2 — Sign up at Railway

Go to https://railway.app and sign up (free, use your GitHub or GitLab account).

### Step 3 — Create a new project

1. Click **New Project**
2. Choose **Deploy from GitHub repo** (Railway can connect to GitLab too via GitHub mirror, OR you can just click **Empty Project** and use the Railway CLI — but the easiest route is to push to GitHub)

> **Tip:** Easiest if you have GitHub. If you want to stick with GitLab, Railway has a GitLab integration under Settings — connect it there.

### Step 4 — Add a MySQL database

In your Railway project:
1. Click **+ New** → **Database** → **MySQL**
2. Railway spins up a MySQL instance and gives you `MYSQL_URL` automatically

### Step 5 — Add the backend service

1. Click **+ New** → **GitHub/GitLab Repo** → select `fittrack-capstone`
2. Set the **Root Directory** to `backend`
3. Railway auto-detects Node.js and will run `npm start`

### Step 6 — Set environment variables

In the backend service → **Variables** tab, add:
```
JWT_SECRET=<paste a long random string>
CLIENT_URL=https://<your-netlify-url>.netlify.app
```

Railway automatically injects `MYSQL_URL` from the database you created — you don't need to set it manually.

### Step 7 — Run the schema

Once deployed:
1. Click your MySQL service → **Connect** → open the **Query** tab
2. Paste the contents of `backend/database/schema.sql` and run it

This creates all 6 tables.

### Step 8 — Note your backend URL

In the backend service → **Settings** → copy the public domain. It looks like:
`https://fittrack-backend-production.up.railway.app`

You'll need this for the frontend.

---

## PHASE 2 — Deploy the Frontend (Netlify)

### Step 1 — Set the API URL

In `frontend/.env.local`, set:
```
VITE_API_URL=https://fittrack-backend-production.up.railway.app
```

Then commit and push this file to your repo (or set it as a Netlify env var — see Step 4).

### Step 2 — Sign up at Netlify

Go to https://www.netlify.com and sign up for free.

### Step 3 — Import your repo

1. Click **Add new site** → **Import an existing project**
2. Connect GitHub or GitLab → select `fittrack-capstone`
3. Set build settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`

### Step 4 — Set environment variable

In Netlify: **Site Settings** → **Environment Variables** → add:
```
VITE_API_URL = https://fittrack-backend-production.up.railway.app
```

(Use your actual Railway URL from Phase 1 Step 8.)

### Step 5 — Deploy

Click **Deploy site**. Netlify builds and gives you a URL like:
`https://fittrack-tyson.netlify.app`

Go back to Railway and update `CLIENT_URL` to match this Netlify URL.

---

## PHASE 3 — Add to iPhone Home Screen

1. Open Safari on iPhone (must be Safari, not Chrome)
2. Navigate to your Netlify URL
3. Tap the **Share** button (box with arrow at bottom of screen)
4. Scroll down and tap **Add to Home Screen**
5. Name it **Reptura** → tap **Add**

Reptura now appears on your home screen with its icon and launches full-screen with no browser chrome, exactly like a native app.

**Share with friends:** send them your reptura.fit URL. They do the same Add to Home Screen steps on their iPhone or Android.

---

## Notes

**Progress photos on Railway free tier:**
Railway's free tier has ephemeral disk storage, which means uploaded photos may not persist if the service restarts. For personal use with a few people this is usually fine short-term. When you're ready to fix it properly, the upgrade path is to store photos in Cloudinary (free tier available) instead of the local filesystem — I can add that later.

**Custom domain:**
Both Railway and Netlify let you connect a custom domain for free once you own one. Reptura is now connected to **reptura.fit** via Netlify (A record → Netlify's load balancer, CNAME on `www` → the Netlify subdomain). If you later add a custom domain on the Railway backend too (e.g. `api.reptura.fit`), remember to update `VITE_API_URL` on Netlify and `CLIENT_URL` on Railway to match.

**Costs:**
As long as usage stays light (personal + friends), Railway and Netlify both stay free. Railway's free tier gives you $5/month in credits which is enough for a small backend + MySQL.
