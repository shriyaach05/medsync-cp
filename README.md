# MedSync

A secure medical records web app where patients or guardians store encrypted medical reports, prescriptions, and lab results, generate simple-language AI summaries via Google Gemini, and share selected PDFs with registered doctors for a limited time.

---

## Tech Stack
- **Backend:** Node.js 20+, Express, Mongoose, MongoDB + GridFS
- **Frontend:** React 18 + Vite, React Router, plain CSS with CSS variables (light & dark themes)
- **Security:** AES-256-GCM file encryption, `httpOnly` JWT cookies, `helmet`, `cors`, `express-rate-limit`, `zod`, `bcrypt`
- **AI:** Google Gemini API (called only from the backend)

---

## Project Structure
MedSync/
│
├── client/                     # React frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── ...
│   │   └── ...
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
│
├── server/                     # Express backend
│   ├── ...
│   ├── .env.example
│   ├── package.json
│   └── ...
│
└── README.md

## Live Link

https://medsync-cp.vercel.app


