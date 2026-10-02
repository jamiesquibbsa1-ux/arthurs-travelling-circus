# Arthur's Holiday Passport

A phone-first family holiday diary with food and drink reviews, photo and quote voting, nearby place search, trip details, family profiles and deliberately overconfident holiday awards.

## Preview

Run `python3 -m http.server 8080` from this folder and open `http://localhost:8080`.

## Publish the website

This is a static website. Put the contents of this folder together at the root of a static HTTPS host. Keep `circus-logo.jpg` beside `index.html`; the header, browser icon and installed app icon all use that file. The browser asks permission before reading device location.

## Search places around Fuengirola

Open **Places**, type a bar, restaurant or place name, and tap **Search**. Choose the matching result; its name and address fill into the form below. This quick version uses OpenStreetMap search and needs no account, API key or billing setup. Results depend on what is listed in OpenStreetMap, and the app displays the required map-data attribution. The final saved place links out to Google Maps for directions.

The original Google Places connection can be wired in later when the existing Tiny Tales search setup is available to reuse.

## Current storage

Entries, reviews, profiles and diary photos save in the current browser on the current device. The Family screen can download or restore a JSON backup. Automatic sharing between phones and the Android wrapper still needs a shared online database.
