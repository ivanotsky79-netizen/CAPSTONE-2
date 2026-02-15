# Professional Cloud Setup (No Credit Card Required)

Since Glitch is giving you trouble, we will use **Replit**. It is a very popular, free coding platform that runs Node.js apps easily.

## Step 1: Deploy Backend to Replit
1.  Go to **[Replit.com](https://replit.com)** and sign up (login with GitHub makes it easy).
2.  Click **"+ Create Repl"** (usually top left).
3.  Click the **"Import from GitHub"** button (top right of the popup).
4.  Paste your GitHub repository URL (e.g., `https://github.com/yourname/CAPSTONE-2`).
    *   *Get this URL from your GitHub Desktop -> Repository -> View on GitHub*.
5.  **Configure the Run Command**:
    *   Replit will try to detect the language. It should say **Node.js**.
    *   It might ask for a "Configure Repl" step.
    *   **Run Command**: `npm install && node backend/server.js`
        *   (Important: we need to tell it to look in the `backend` folder).
6.  **Add Environment Variables (Secrets)**:
    *   On the left sidebar, look for a "Lock" icon 🔒 called **Secrets** or **Environment Variables**.
    *   Click it.
    *   **Key**: `FIREBASE_SERVICE_ACCOUNT`
    *   **Value**: *Copy EVERYTHING from your `backend/serviceAccountKey.json` and paste it here.*
    *   Click **"Add Secret"**.
7.  **Run**:
    *   Click the big green **"Run"** button at the top.
    *   A small window will open (WebView). The URL above that small window is your **Backend URL**.
    *   It looks like: `https://capstone-2.yourusername.repl.co`

---

## Step 2: Update the Mobile App
Once you have the Replit URL, copy it and paste it here! I will update `mobile-app/src/services/api.js`.

---


## Step 4: Deploy Frontend (Cloud Website)
To make your Admin Dashboard available as a website (no installation needed):

1.  **Sync your Changes**:
    *   Open GitHub Desktop.
    *   Commit changes ("Update for Cloud Deployment").
    *   Push to Origin.

2.  **Update Replit**:
    *   Go back to your Replit project.
    *   In the **Shell** (black terminal window), run this command:
    *   `git pull`
    *   (This downloads your latest code changes).

3.  **Install & Build Frontend**:
    *   In the same Replit Shell, run this exact command (copy-paste it):
    *   `cd frontend && npm install && npm run build && cd ..`
    *   (This builds your React website).

4.  **Restart**:
    *   Click "Stop" (top center).
    *   Click "Run" (green button).

5.  **Done!**
    *   The "Webview" window will now show your **Admin Dashboard Login**.
    *   You can share the URL (e.g., `https://...repl.co`) with anyone!
