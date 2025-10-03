<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Inventory Management System

A React + Vite inventory management dashboard that can run in an offline demo mode or connect to Firebase for real data.

## Prerequisites
- Node.js 20+
- A Firebase project with Firestore and Google authentication enabled
- A Netlify account (for hosting)

## Local Development
1. Install dependencies: `npm install`
2. Copy `.env.local` and replace each placeholder with the Firebase web app settings from the Firebase console (Project settings -> Your apps -> Web app)
3. Allow `localhost` in **Firebase Console -> Authentication -> Settings -> Authorized domains**
4. Start the dev server: `npm run dev`

## Firebase Configuration
- Firestore: create the collections used by the app (`users`, `stores`, `permissions`, `items`, `categories`, `locations`, `stocktakes`). The UI expects documents shaped like the Firestore API in `services/api.ts`.
- Authentication: enable **Google** as a sign-in method.
- Service accounts & security rules: customise rules to match your data model before going live. The repository defaults to client-side access.

## Environment Variables
All Firebase credentials are read from `import.meta.env` at build time. Populate the following keys locally and in Netlify:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID (optional)
```

## Deploying to Netlify
1. Push this project to Git (or drag-and-drop a build folder) and create a new site on Netlify.
2. In **Site settings -> Build & deploy -> Environment**, add the variables listed above.
3. Netlify will use the included `netlify.toml` (`npm run build`, publish `dist/`, and single-page redirects) so no extra configuration is needed.
4. Trigger a deploy. Once deployed, add your Netlify domain to Firebase authorized domains to enable Google sign-in.

## User Invitations
- Settings -> Invitations lets admins generate codes or pre-assign access by email. Codes are stored in Firestore under the `invites` collection (document ID = shareable code).
- Invites with an email address are applied automatically on the next login; code-based invites can be redeemed from the header button **Enter invite code** after signing in.
- Update your Firestore rules so authenticated admins can create/revoke invites and authenticated users can read/redeem their own codes. A starting point is to allow `invites` reads to any signed-in user and restrict writes to users who already have Role.Admin for the related store.
- Remember to add the `invites` collection to your rules/index plan if you filter by email or storeId.

## Optional: Netlify CLI Preview
```
npm install -g netlify-cli
netlify login
netlify dev
```
This reads `.env.local`, proxies Firebase calls, and uses the same build settings as production.
