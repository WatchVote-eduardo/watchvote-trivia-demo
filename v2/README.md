# WatchVote Daily Trivia v2

Static demo, independent of the one- and four-question versions. Load it at `/v2/`. Use `?date=2026-11-25` to view the Wednesday picture question or `?date=2026-11-27` for the Friday Bench. Date preview uses a separate sandbox from your regular history. A challenge link uses this demo’s URL; share text and images show the intended production address without contacting it.

Questions are stored one per entry in `questions.json`. Add four entries with slots 1–4 for each date. A missing date cycles through the deck. Put a generic or authorized `image` on an image question and use `bench` only for signed guest questions. `votes` contains the sample option counts; the demo adds the browser’s own vote after lock-in. The Miami time zone, weekly special days, picture slot, and rank thresholds live in `config.json`.

This static demo necessarily ships the answer key in its JSON. For a WordPress integration, serve prompts and options without the key, send choices to an authenticated server, and return the correct answer, explanation, and poll results only after locking that choice. Keep day, scores, streaks, and community results authoritative on the server. The view and share modules are independent of browser storage; `app.mjs` wires them to the static demo data.

Run the model tests from the repo root with `node --test v2/model.test.mjs`.
