import { challengeFrom, displayDay, gameDay, makeSchedule, rankFor, resultsFor, scoreHistory, summarize, validDay } from "./model.mjs";
import { sharePanel } from "./share.mjs";
import { comparison, leaderboard, questionCard } from "./view.mjs";

const storageKey = "watchvote-trivia-v2";
const previewKey = `${storageKey}-date-preview`;
const url = new URL(location.href);
const challenge = challengeFrom(url);
const override = challenge ? null : url.searchParams.get("date");
const datePreview = validDay(override);
const key = datePreview ? previewKey : storageKey;
const dom = Object.fromEntries([
	"round-date", "today", "challenge-note", "progress", "rank", "rank-progress", "level-up", "questions", "social", "boards"
].map((id) => [id, document.getElementById(id)]));
let cached;
let canStore = true;
let config;
let getRound;
let shownDay;

function readState() {
	if (canStore) {
		try {
			const state = JSON.parse(localStorage.getItem(key));
			if (state?.history && state?.practice) cached = state;
		} catch {
			canStore = false;
		}
	}
	return cached ?? { history: {}, practice: {} };
}

function writeState(state) {
	cached = state;
	if (canStore) {
		try {
			localStorage.setItem(key, JSON.stringify(state));
		} catch {
			canStore = false;
		}
	}
}

function today() {
	return datePreview ? override : gameDay(new Date(), config.time_zone);
}

function roundState(state, currentDay) {
	const date = challenge?.date || currentDay;
	const practice = date !== currentDay;
	const answers = practice ? { ...state.history[date], ...state.practice[date] } : state.history[date];
	return { date, practice, answers };
}

function drawScores(state, day, round, choices, levelUp) {
	const quiz = getRound(round.date);
	const results = resultsFor(quiz, choices);
	const { played, correct } = summarize(results);
	const stats = scoreHistory(getRound, state.history, day);
	const rank = rankFor(config.ranks, stats.correct);
	dom.progress.textContent = `${played}/4 answered · ${correct}/4 correct${played === 4 ? " · Round complete" : ""}`;
	dom.rank.textContent = `Your title: ${rank.title}`;
	dom["rank-progress"].textContent = rank.next ?
		`${rank.remaining} more correct ${rank.remaining === 1 ? "answer" : "answers"} to ${rank.next}` : "You’ve reached the highest title.";
	if (levelUp) {
		dom["level-up"].hidden = false;
		dom["level-up"].textContent = `New title earned: ${rank.title}.`;
	}
	const players = [...config.sample_players, { name: "You", you: true, ...stats }];
	dom.boards.replaceChildren(leaderboard(players, config.ranks, false), leaderboard(players, config.ranks, true));
	const panels = [];
	if (challenge && played === 4) panels.push(comparison(challenge, results));
	if (played) panels.push(sharePanel({
		date: round.date, results, streak: stats.current, rank: rank.title, shareUrl: config.share_url,
		bench: quiz.find((question) => question.bench)?.bench.name
	}, played === 4));
	dom.social.replaceChildren(...panels);
}

function draw() {
	const day = today();
	shownDay = day;
	const state = readState();
	const round = roundState(state, day);
	const quiz = getRound(round.date);
	dom["round-date"].dateTime = round.date;
	dom["round-date"].textContent = displayDay(round.date);
	dom.today.textContent = challenge ? "Friend challenge" : datePreview ? "Demo date preview" : "Today’s round";
	const note = dom["challenge-note"];
	note.hidden = !challenge && !datePreview;
	if (challenge) {
		note.textContent = `${challenge.name} scored ${summarize(challenge.results).correct}/4. Can you beat their score?` +
			(round.practice ? " This round is outside today’s Miami date. Playing it won’t affect your streak or totals." : "");
	} else if (datePreview) {
		note.textContent = "Progress in date preview is separate from your regular daily scores.";
	}
	dom["level-up"].hidden = true;
	dom.questions.replaceChildren(...quiz.map((question) => questionCard(question, round.answers?.[question.slot], (slot, choice) => {
		const latest = readState();
		const current = roundState(latest, day);
		if (day !== today() || resultsFor(quiz, current.answers)[slot - 1] !== "-") {
			draw();
			return false;
		}
		const before = scoreHistory(getRound, latest.history, day);
		const choices = { ...current.answers, [slot]: choice };
		const history = current.practice ? latest.practice : latest.history;
		history[current.date] = choices;
		writeState(latest);
		const after = scoreHistory(getRound, latest.history, day);
		drawScores(latest, day, current, choices,
			rankFor(config.ranks, before.correct).title !== rankFor(config.ranks, after.correct).title);
		return true;
	})));
	drawScores(state, day, round, round.answers);
}

async function loadJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`Cannot load ${path}`);
	return response.json();
}

try {
	const [questions, settings] = await Promise.all([loadJson("./questions.json"), loadJson("./config.json")]);
	config = settings;
	getRound = makeSchedule(questions, settings);
	draw();
	window.addEventListener("storage", (event) => {
		if (event.key === key || event.key === null) {
			cached = undefined;
			draw();
		}
	});
	setInterval(() => {
		if (today() !== shownDay) draw();
	}, 1000);
} catch {
	dom.progress.textContent = "Today’s questions couldn’t load. Refresh to try again.";
}
