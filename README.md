# MedSync

A secure medical records web app where patients or guardians store encrypted medical reports, prescriptions, and lab results, generate simple-language AI summaries via Google Gemini, and share selected PDFs with registered doctors for a limited time.

---

## Tech Stack
- **Backend:** Node.js 20+, Express, Mongoose, MongoDB + GridFS
- **Frontend:** React 18 + Vite, React Router, plain CSS with CSS variables (light & dark themes)
- **Security:** AES-256-GCM file encryption, `httpOnly` JWT cookies, `helmet`, `cors`, `express-rate-limit`, `zod`, `bcrypt`
- **AI:** Google Gemini API (called only from the backend)

---

## Local Development Setup

### 1. Backend (`server/`)
```bash
cd server
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET (64 hex chars), FILE_ENCRYPTION_KEY (64 hex chars), and GEMINI_API_KEY
npm install
npm run dev
```

Generate 64-character hex secrets using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run backend tests:
```bash
cd server
npm test
```

### 2. Frontend (`client/`)
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

---

## Production Deployment over HTTPS (Phase 14)

Because MedSync uses `httpOnly`, `Secure`, `SameSite=None` cookies in production, **both** the frontend and backend must be served over **HTTPS** with matching CORS settings.

### Step 1: Configure MongoDB Atlas
1. Create a free M0 cluster in [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a database user with `readWrite` permission on the `medsync` database.
3. Under **Network Access**, add your backend host's outbound IP addresses (or `0.0.0.0/0` if your PaaS uses dynamic IPs, protected by strong username/password credentials).
4. Copy the connection string (`mongodb+srv://<user>:<password>@<cluster>.mongodb.net/medsync?retryWrites=true&w=majority`).

### Step 2: Deploy the Backend (Render / Railway) over HTTPS
1. Connect this GitHub repository and set the **Root Directory** to `server`.
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. Set these **Environment Variables** in your hosting dashboard:
   - `NODE_ENV=production`
   - `PORT=5000` (or leave default if the platform assigns `PORT`)
   - `MONGODB_URI=<your MongoDB Atlas URI>`
   - `JWT_SECRET=<64-char random hex string>`
   - `FILE_ENCRYPTION_KEY=<64-char random hex string>`
   - `GEMINI_API_KEY=<your Google AI Studio API key>`
   - `GEMINI_MODEL=gemini-flash-latest`
   - `GEMINI_FALLBACK_MODEL=gemini-flash-lite-latest`
   - `CLIENT_ORIGIN=https://<your-frontend-domain>` (no trailing slash)
5. Deploy and verify `https://<your-backend-domain>/api/health` returns `{ "status": "ok", "database": "connected" }`.

### Step 3: Deploy the Frontend (Vercel / Netlify) over HTTPS
1. Connect this GitHub repository and set the **Root Directory** to `client`.
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`
4. Set **Environment Variable**:
   - `VITE_API_URL=https://<your-backend-domain>/api`
5. SPA routing rewrites are already included via [client/vercel.json](client/vercel.json) and [client/public/_redirects](client/public/_redirects).
6. After deployment, make sure `CLIENT_ORIGIN` on the backend exactly matches your live `https://...` frontend URL.

### Step 4: Post-Deployment Checklist
- [ ] `GET https://<backend>/api/health` returns `200 OK` and `"database": "connected"`.
- [ ] Registering and logging in sets the `medsync_token` cookie (`HttpOnly`, `Secure`, `SameSite=None`).
- [ ] Uploading a PDF or photo stores an encrypted file in GridFS and opens cleanly in **View PDF**.
- [ ] **Autofill** and **Summary** work with your `GEMINI_API_KEY`.
- [ ] Sharing a report with a registered doctor makes it appear in the doctor's **Inbox** with a live countdown.
