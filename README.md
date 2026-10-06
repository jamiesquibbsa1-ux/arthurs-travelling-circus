# Arthur's Holiday Passport

A lighthearted family holiday diary for places, food and drink reviews, photos, quotes, reactions, comments and solo photo quizzes.

## Put this update on GitHub Pages

1. Download and extract this ZIP.
2. Open the repository's **Upload files** page.
3. Choose every file and folder inside the extracted ZIP. Upload the contents, including `assets`, rather than uploading the ZIP itself.
4. Commit the changes to the `main` branch at the repository root.
5. Open the live site after GitHub Pages finishes deploying. If it still shows the previous version, close the old browser tab and reopen the site.

The shared Supabase tables, private photo storage and admin service are already installed for this app. On the first visit, choose **First time here? Set up the family admin** and enter the one-time setup code supplied separately. Create the admin name and password. From the Family tab, that admin can create each player's name and password.

## How the family features work

- Each person signs in with their assigned name and password. Passwords are stored by Supabase Auth, not in the site files.
- The family shares places, ratings, diary photos and quotes, comments, reactions and quiz results across devices.
- Anyone can add and rate places, post photos or quotes, comment, react, and play a published quiz on their own.
- Admins can add accounts, promote players to admin, publish quizzes and reveal the answers and scores.
- Quiz correct answers are kept out of the player-facing database access until the admin reveals them.

## Place search

The quick Fuengirola place search uses OpenStreetMap's public search service. Type a restaurant, bar or other place name, tap **Search**, then select the matching result. The site asks before using device location. Saved places include a Google Maps directions link.

## Preview locally

From this folder, run `python3 -m http.server 8080` and open `http://localhost:8080`. Shared sign-in and family features require the deployed Supabase backend and an HTTPS connection.
