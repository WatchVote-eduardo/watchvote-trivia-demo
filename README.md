# WatchVote Daily Trivia Demo

A static, no-sign-in demo. Scores and streaks stay in the visitor's browser; other names on the two leaderboards are fictional. There is no backend or connection to WordPress or WhatsApp.

Serve the repository root using `python3 -m http.server 8765 --bind 127.0.0.1` for local preview, or publish the root of `main` with GitHub Pages. No build step is required.

Update `questions.json` with questions in chronological order. The date uses the visitor's local calendar; on days not listed, the demo cycles through the deck. Run `node --test rounds.test.mjs` to check date and scoring logic.
