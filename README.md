# FUGEN SmartPay System 

## Overview
A cashless canteen system for the Future Generation Philippine International School in Riyadh Saudi Arabia.
- **Currency:** Saudi Riyal (SAR)
- **Authentication:** Student ID QR Code + 4-Digit Passkey
- **Debt Logic:** Auto-deduction from next top-up.

## 1. Web Dashboard (FOR Admin Only)
Located in `/frontend`.
- **Role:** Admin / School Office
- **Features:** Create Students, Generate QR Stickers, Load Balance (Top-Up).
- **Run:** 
```bash
cd frontend
npm install
npm run dev
```
- Access at: `http://localhost:5173`

## 2. Mobile App (For the QR Scanner)
Located in `/mobile-app`.
- **QR Scanning**: Uses device camera.
- **Top-Ups**: Handles cash intake and debt deduction.
- **Run**: `cd mobile-app && npx expo start`
  - Scan the QR code with Expo Go on your phone.
  - **Important**: Update `API_URL` in `App.js` to your computer's local IP address.

### 📱 Mobile Troubleshooting
FOR Red Error Screen(e.g., "String cannot be cast to Boolean"):
1. Stop the terminal (**Ctrl + C**).
2. Run this command to clear the cache:
   ```bash
   npx expo start -c
   ```
3. Restart the app on your phone.

## 3. Backend (Shared API)
Located in `/backend`.
- **Tech:** Node.js + Express + Firebase Admin
- **Run:**
```bash
cd backend
npm install
npm run dev
```
- Server runs on: `http://localhost:5000`

## Quick Start Guide

1. **Start Backend:**
   Open Terminal 1:
   ```bash
   cd backend && npm run dev
   ```

2. **Start Admin Dashboard:**
   Open Terminal 2:
   ```bash
   cd frontend && npm run dev
   ```
   *Go to the browser, create a student, and set a passkey (e.g. 1234).*

3. **Start Canteen App:**
   Open Terminal 3:
   ```bash
   cd mobile-app && npx expo start
   ```
   *Scan the QR code from the Admin Dashboard using the App.*
