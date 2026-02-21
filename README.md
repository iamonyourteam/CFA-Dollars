# Chick-fil-A Dollar Tracker (Firebase Edition)

All data is stored in Firebase Firestore — syncs across every device in real time.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Default PINs

| Role     | Name      | PIN  |
|----------|-----------|------|
| Admin    | Admin 1   | 9999 |
| Manager  | Manager 1 | 1111 |
| Manager  | Manager 2 | 2222 |
| Manager  | Manager 3 | 3333 |
| Employee | Each emp  | 4001–4055 |

Change all PINs after first login via the Manage PINs screen.

## Deploy to Netlify

```bash
npm run build
```

Drag the `dist` folder onto netlify.com → instant live URL.

## Firebase Rules (important!)

In the Firebase console → Firestore → Rules, update to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

This is fine for an internal team app. For extra security you can add auth later.
