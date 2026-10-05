# Arthur's Travelling Circus

**Eat. Drink. Rate. Repeat.**

Cross-platform family holiday review app starter for Android and iPhone.

## What is already in this starter

- Trips home screen and Big Top leaderboard
- Interactive map with saved venue pins
- Adult and kid profile switching
- Food / Drink / Both review modes
- 1–5 star scoring
- Adult core + fun scores, including Proper Glass?, One More Then?, Tapas Test, Wallet Damage, Vibe Check, People Watching, Holiday Feeling, Loo Rating, Pint Test, Cocktail Test, Wine Test, Tomorrow Morning Risk and Worth the Walk?
- Kid-specific fun scoring
- Venue page with combined family score plus adult/kid score split
- Big Top Awards screen
- Supabase schema with family-scoped RLS
- Google Places autocomplete Edge Function starter so the Places API key can stay off the phones

The app currently runs in **demo/local mode**. Reviews, diary entries and votes now persist on this phone. They do not sync to other phones yet. Photo files are copied into app document storage; uninstalling the app removes local data.

## Run on Android

1. Install Node 22.13+ and Expo Go on the Android phone.
2. In this folder run:
   ```bash
   npm install
   npx expo install --fix
   npx expo start
   ```
3. Scan the QR code with Expo Go.

Expo SDK 57 targets React Native 0.86 and Android/iOS from one codebase.

## Connect Supabase

Create a dedicated Supabase project for this app. Copy `.env.example` to `.env` and fill:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Then apply `supabase/schema.sql` to that project. Before production, run Supabase security/performance advisors and test every RLS path.

## Google Places search

The map itself uses `react-native-maps`. The included `places-search` Edge Function is the server-side foundation for searching real bars/restaurants via Google Places API (New). Store `GOOGLE_PLACES_API_KEY` as a Supabase Edge Function secret; do not hard-code it into the app.

## Next build phase

1. Create the dedicated Supabase project.
2. Add sign-in and family creation/joining.
3. Connect app screens to live Supabase rows/realtime.
4. Add kid PIN validation.
5. Connect Google Places search and Place Details.
6. Connect the local diary/photo/vote flows to authenticated shared storage.
7. Add trip creation and automatic awards.
8. Build an Android APK/AAB for testing and Play Store distribution.

## Version 0.2 — Holiday diary and daily voting

- New Diary tab: photos from the phone gallery, captions and memorable quotes.
- Date-based diary browsing, including earlier holiday days.
- A separate photo and quote vote per profile per day; selecting another replaces the vote, selecting the same withdraws it.
- Live provisional leaders, tied winners and no winner when no votes exist.
- Authors can delete their own entries; associated votes are removed.
- Reviews, entries and votes saved locally, with failed-save feedback and protection against overwriting unreadable saves.
- Gallery images copied out of temporary picker storage.

Profiles are currently demo selectors, not authenticated identities. Voting is for testing on one phone only. No cloud backend has been changed. The available Supabase project is inactive and has not been assumed to belong to this app.

## Android test APK

`eas.json` includes a preview APK profile. Once the app is installed, dependencies checked and Expo/EAS authenticated:

```bash
npx expo install --fix
npm run typecheck
npx eas-cli build --platform android --profile preview
```

An APK has not been produced in this workspace. Dependencies have been installed and checked, TypeScript checks passed, and an Android JavaScript bundle was exported. A full device run remains required. See `BUILD-STATUS.md` for the validation performed here.

## Version 0.3 — Vintage travel passport theme

The provided coach logo is bundled at `assets/circus-logo.png` and used on the passport home screen. It is preserved unchanged. The app uses parchment and cream surfaces, burgundy headings/actions, navy navigation, faded gold accents, Mediterranean blue stamps and serif headings. Destination/date stamps, document lettering, ticket-style borders and passport labels connect the trip, diary, rating, family and awards screens. Decorative stamps describe the section; they do not imply verification or a real visited stamp.

The logo stays compact above the current trip; it is not repeated behind forms or photos. Diary pictures retain clear captions and voting controls. System serif and monospace fonts avoid adding font-download requirements.

## Version 0.4 — Live feed, comments and multiple photos

- Added a Live Feed tab combining venue reviews, diary photos and quotes in date order.
- Feed cards show the author, venue or entry type, star rating or photo/quote status, captions and any detailed review scores.
- Added Like, Laugh, Love and Hate reactions and a comment thread on every feed item.
- Photo posts can select multiple images at once and add more before saving. There is no app-level photo count cap; available phone storage still applies.
- Existing venue review comments remain available and now appear in the feed.
- Local save data upgrades from version 1 to version 2 without removing earlier reviews, diary entries or votes.
- The feed and comments currently use this phone's local save. They do not update on other phones in real time; that needs family accounts, shared photo storage and a connected Supabase project, which are not configured in this starter.

## EAS account link

The app is configured for the existing Expo owner `squibbjr` and project slug `arthurscircus`, matching the project page Jamie supplied. EAS account authentication is still needed to read/link the project ID and submit a build. Do not create a replacement project.
