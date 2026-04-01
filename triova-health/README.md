# TRIOVA Health Platform

A comprehensive, AI-driven healthcare platform designed to streamline patient triage, appointment booking, medical record analysis, and continuous health monitoring.

## 🚀 Architecture Overview

TRIOVA is built as a **Modular Monolith** pattern within a Node.js/TypeScript monorepo.

### Backend Infrastructure
*   **Runtime:** Node.js (v20) + Express.js
*   **Database:** PostgreSQL 15 (Node `pg` pool)
*   **Cache & Queues:** Redis 7 + BullMQ
*   **Vector Store:** Qdrant (for Medical RAG)
*   **AI Integration:** OpenAI GPT-4o, Whisper, Vision, Embeddings
*   **Realtime:** Socket.io
*   **Gateway:** `http-proxy-middleware` routing all `/api/*` traffic

### Frontend Infrastructure
*   **Framework:** React 18 + Vite + TypeScript
*   **Styling:** Tailwind CSS + Shadcn UI
*   **State:** Zustand (Auth) + React hooks
*   **API Client:** Axios (intercepted for JWT)
*   **Realtime:** Socket.io-client
*   **Charts:** Recharts

## 📦 Service Breakdown

1.  **Auth Service (Port 3001):** Role-based JWT authentication (Patient, Doctor, Admin).
2.  **Patient Service (Port 3002):** Patient demographic, condition, and medication CRUD.
3.  **Doctor Service (Port 3003):** Doctor availability slots and profiles.
4.  **Appointment Service (Port 3004):** Booking engine, queue management, voice-based booking (Whisper).
5.  **Triage Service (Port 3005):** AI-driven symptom analysis, emergency detection, vision imaging.
6.  **Medical Records Service (Port 3006):** Patient document upload, OCR pipelines (pdf-parse/Tesseract via BullMQ), Qdrant RAG embeddings, and PDF generation.
7.  **Analytics Service (Port 3007):** Wearable data ingestion, chron-based longitudinal baseline calculations, realtime anomaly detection health score.
8.  **Notification Service (Port 3008):** BullMQ workers managing Email (Nodemailer) and SMS (Twilio) channels for background reminders.
9.  **API Gateway (Port 3000):** Central proxy merging all underlying services behind a unified host, tracking and relaying Socket.io notifications.

## 🛠️ Local Setup & Getting Started

### Prerequisites
*   Node.js > 18
*   Docker & Docker Compose

### 1. Environment Configuration

Copy the example environment file and fill in API keys:
```bash
cp .env.example .env
```
*Required keys for full AI functionality:* `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `EMAIL_USER`.

### 2. Start Infrastructure

Start the Postgres DB, Redis, and Qdrant instances:
```bash
docker compose up -d
```

### 3. Install Dependencies & Seed Data

Install monorepo dependencies and execute migrations along with dummy data:
```bash
npm install
node seed.js
```

### 4. Run the Platform

From the root directory, leverage `concurrently` to spin up every microservice and the Vite React frontend simultaneously:
```bash
npm run dev
```

The application will be accessible at:
*   **Frontend UI:** `http://localhost:5173`
*   **API Gateway:** `http://localhost:3000`

### 🧪 Test Accounts
*   **Patient:** `jdoe@example.com` (password: `password123`)
*   **Doctor:** `dr.smith@triova.health` (password: `password123`)
