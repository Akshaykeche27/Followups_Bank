# Bank Follow-up Manager

A private, mobile-friendly customer follow-up app built with **Node.js, Express, MongoDB and vanilla HTML/CSS/JavaScript**.

## Included features

- Add, view, edit and delete customer records.
- Customer fields: name, mobile number, optional location, repayment category, editable list/group name and current status.
- Repayment categories: Standard Regular, SMA 0, SMA 1, SMA 2 and NPA.
- Use `List 1`, `List 2` or type any custom list/group name.
- Tap a customer's mobile number to open the phone dialer.
- Schedule the next follow-up date and time.
- Save a follow-up result as Pending or Recovered.
- Every follow-up is saved in dated history; the latest remark is also shown on the customer record.
- Dashboard date filter showing scheduled customers, completed follow-ups, recoveries, total pending customers and overdue follow-ups.
- Customer filters for search, list, repayment category, status and follow-up date.
- Dated Short Notes with create, edit, delete, date filter and search.
- Dark responsive interface for desktop and mobile.
- Username/password login and MongoDB-backed sessions.
- Dates and times are interpreted in India Standard Time (IST).

## 1. Requirements

Install **Node.js 18 or newer** and create a MongoDB database (MongoDB Atlas is suitable).

## 2. Set up the project

Open a terminal inside this folder and run:

```bash
npm install
```

Copy `.env.example` to `.env` and edit the values:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/bank_followup_manager?retryWrites=true&w=majority
APP_USERNAME=choose-a-username
APP_PASSWORD=use-a-long-unique-password
SESSION_SECRET=use-a-long-random-secret-value-at-least-32-characters
NODE_ENV=development
PORT=3000
```

Keep `.env` private. It is excluded from Git by `.gitignore`.

## 3. Run locally

```bash
npm start
```

Open `http://localhost:3000` in your browser and sign in with `APP_USERNAME` and `APP_PASSWORD` from `.env`.

For development with automatic restart (Node.js 20.11+):

```bash
npm run dev
```

## 4. Deploy on Render

1. Push this project to a **private GitHub repository**.
2. In Render, create a **New Web Service** and connect that repository.
3. Use these settings:
   - Runtime: `Node`
   - Build command: `npm install`
   - Start command: `npm start`
4. Add the environment variables from `.env.example` in Render's Environment section. Use your real MongoDB Atlas connection string and strong unique values for the username, password and session secret.
5. Set `NODE_ENV` to `production` in Render Environment variables. This enables secure session cookies.
6. In MongoDB Atlas Network Access, allow connections from your Render service. For a production setup, use the narrowest network access method available to your hosting plan rather than leaving the database open to everyone.
7. Deploy and open the Render URL. Render provides HTTPS, which the app uses for secure session cookies in production.

## 5. Push to GitHub

Run these commands from the project folder (replace the URL with your own private repository URL):

```bash
git init
git add .
git commit -m "Build bank follow-up manager"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If the GitHub repository is already connected, use:

```bash
git add .
git commit -m "Update bank follow-up manager"
git push
```

## Data behaviour

- A follow-up action creates a separate dated history record.
- The customer's `lastRemark` is overwritten with the newest remark, so the current customer table always shows the latest update.
- Marking a customer as **Recovered** clears their next scheduled follow-up.
- Marking a customer as **Pending** keeps the existing schedule unless a new next follow-up date is entered.
- Dashboard date selection filters scheduled customers and activity for that particular IST date. Total Pending is the current count across all dates; Overdue counts pending customers whose next follow-up date is before the selected date.

## Important privacy note

This is a personal tracking tool, **not an official bank system**. Customer names, phone numbers and repayment information may be confidential. Use real customer data only if your employer permits this storage and hosting arrangement. Do not upload customer data to a personal cloud database or public repository without authorization. Use a private repository, a strong password, HTTPS, and restrict database access. This first version does not include bank SSO, role-based access, audit approval or an automated backup workflow.
