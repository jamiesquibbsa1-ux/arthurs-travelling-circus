# Arthur's Travelling Circus

**Eat. Drink. Rate. Repeat.**

The project is now web-first. `web/` contains the responsive browser app; it can run as a home-screen web app on Android and iPhone. `android-wrapper/` contains the small Android app shell that opens the same hosted website. The old Expo source remains here as the earlier native prototype, but it is no longer the recommended build path.

## Web app

The web app includes a family travel passport, saved holiday stops, star ratings and comments, a photo and quote diary with daily voting, a leaderboard/awards screen, and family profile switching. It is built as static HTML, CSS, and JavaScript, with no package installation needed.

To preview from this folder:

```sh
cd web
python3 -m http.server 8080
```

Open `http://localhost:8080`. To put it online, push this project to a GitHub repository and enable GitHub Pages with **GitHub Actions** as its source. The included `.github/workflows/publish-and-build.yml` deploys the website and builds an Android APK linked to the deployed address. After its first HTTPS visit, the web app caches its screens for offline use.

See [`web/README.md`](web/README.md) for web hosting and data details.

## Android app

`android-wrapper/` contains a WebView-based Android project with a bundled copy of the web app. The publish workflow uses the new GitHub Pages address to build the linked APK and uploads it as an artifact. The workspace itself does not include the Android SDK or Gradle, so the APK is built by GitHub Actions after the project is in a GitHub repository.

See [`android-wrapper/README.md`](android-wrapper/README.md).

## Current data behavior

This first web build stores places, ratings, profiles, diary entries, compressed diary photos and votes in the browser's local storage. A browser on another device and the Android WebView have their own local stores. The app labels this clearly; it does not claim cross-device family sync is active. Sign-in and shared family data need a configured backend. The project currently has Supabase client/schema scaffolding but no active backend URL or publishable key configured.

## Earlier Expo prototype

The rest of this project includes the earlier Expo/React Native app and local-only feature prototype. Its Android build previously failed in EAS Gradle, which is why the web-first app and lightweight WebView shell are now the straightforward path.
