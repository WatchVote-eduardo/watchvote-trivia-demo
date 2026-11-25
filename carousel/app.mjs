import { challengeFrom, displayDay, gameDay, makeSchedule, rankFor, resultsFor, scoreHistory, summarize, validDay } from "../v2/model.mjs";
import { sharePanel } from "../v2/share.mjs";
import { button, comparison, el, leaderboard, questionCard } from "../v2/view.mjs";
import { firstUnanswered, nextAction, swipeDirection } from "./navigation.mjs";

const storageKey = "watchvote-trivia-carousel";
const url = new URL(location.href);
const shareUrl = new URL("./", url).href;
const challenge = challengeFrom(url);
const override = challenge ? null : url.searchParams.get("date");
const datePreview = validDay(override);
const key = datePreview ? `${storageKey}-date-preview` : storageKey;
const dom = Object.fromEntries([
	"round-date", "today", "challenge-note", "progress", "rank", "rank-progress", "level-up",
	"question-carousel", "questions", "steps", "previous", "next", "round-summary", "summary-title", "summary-score", "social", "boards"
].map((id) => [id, document.getElementById(id)]));
let cached;
let canStore = true;
let config;
let getRound;
let shownDay;
let shownDate;
let active = 0;
let outcomes = "----";
let gesture;
let suppressClick = false;

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

function openSummary() {
	const heading = dom["summary-title"];
	heading.focus({ preventScroll: true });
	dom["round-summary"].scrollIntoView({ block: "start" });
}

function refreshNavigation() {
	const complete = !outcomes.includes("-");
	dom.previous.setAttribute("aria-disabled", String(active === 0));
	dom.next.setAttribute("aria-disabled", String(active === outcomes.length - 1 && !complete));
	dom.next.setAttribute("aria-label", active === outcomes.length - 1 && complete ? "View round summary" : "Next question");
	for (const [index, step] of [...dom.steps.children].entries()) {
		const result = outcomes[index];
		const label = { "1": "correct", "0": "incorrect", "-": "unanswered" }[result];
		step.dataset.result = result;
		step.setAttribute("aria-label", `Question ${index + 1}, ${step.lastChild.textContent}, ${label}`);
		step.firstChild.textContent = { "1": "✓", "0": "×", "-": index + 1 }[result];
		if (index === active) step.setAttribute("aria-current", "step");
		else step.removeAttribute("aria-current");
		const card = dom.questions.children[index];
		card.hidden = index !== active;
		const action = nextAction(outcomes, index);
		const footer = card.lastElementChild;
		footer.replaceChildren();
		if (action) footer.append(button(action.label, () => {
			if (action.index === undefined) openSummary();
			else selectQuestion(action.index);
		}));
	}
}

function selectQuestion(index) {
	if (index === outcomes.length && !outcomes.includes("-")) {
		openSummary();
		return;
	}
	if (index < 0 || index >= outcomes.length || index === active) return;
	dom.questions.dataset.direction = index < active ? "back" : "forward";
	active = index;
	refreshNavigation();
	const heading = dom.questions.children[active].querySelector("h3");
	heading.focus({ preventScroll: true });
	const bounds = dom["question-carousel"].getBoundingClientRect();
	if (bounds.top < 0 || bounds.top > innerHeight / 2) dom["question-carousel"].scrollIntoView({ block: "start" });
}

function drawScores(state, day, round, quiz, choices, levelUp) {
	outcomes = resultsFor(quiz, choices);
	const { played, correct } = summarize(outcomes);
	const complete = played === quiz.length;
	const stats = scoreHistory(getRound, state.history, day);
	const rank = rankFor(config.ranks, stats.correct);
	dom.progress.textContent = `${played}/4 answered · ${correct}/4 correct`;
	dom.rank.textContent = `Your title: ${rank.title}`;
	dom["rank-progress"].textContent = rank.next ?
		`${rank.remaining} more correct ${rank.remaining === 1 ? "answer" : "answers"} to ${rank.next}` : "You’ve reached the highest title.";
	if (levelUp) {
		dom["level-up"].hidden = false;
		dom["level-up"].textContent = `New title earned: ${rank.title}.`;
	}
	const players = [...config.sample_players, { name: "You", you: true, ...stats }];
	dom.boards.replaceChildren(leaderboard(players, config.ranks, false), leaderboard(players, config.ranks, true));
	dom["round-summary"].hidden = !played;
	dom["summary-title"].textContent = complete ? "Round complete" : "Round in progress";
	dom["summary-score"].textContent = `${correct}/4 correct · Streak: ${stats.current} ${stats.current === 1 ? "day" : "days"}`;
	const panels = [];
	if (challenge && complete) panels.push(comparison(challenge, outcomes));
	if (played) panels.push(sharePanel({
		date: round.date, results: outcomes, streak: stats.current, rank: rank.title, shareUrl,
		bench: quiz.find((question) => question.bench)?.bench.name
	}, complete));
	dom.social.replaceChildren(...panels);
	refreshNavigation();
}

function draw() {
	const day = today();
	shownDay = day;
	const state = readState();
	const round = roundState(state, day);
	const quiz = getRound(round.date);
	if (round.date !== shownDate) active = firstUnanswered(resultsFor(quiz, round.answers));
	shownDate = round.date;
	const restoreFocus = dom["question-carousel"].contains(document.activeElement);
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
	dom.steps.replaceChildren(...quiz.map(({ level, slot }) => {
		const step = el("button", "carousel-step");
		step.type = "button";
		step.setAttribute("aria-controls", `slide-${slot}`);
		step.append(el("span", "carousel-dot"), el("span", "", level[0].toUpperCase() + level.slice(1)));
		step.addEventListener("click", () => selectQuestion(slot - 1));
		return step;
	}));
	dom.questions.replaceChildren(...quiz.map((question) => {
		const card = questionCard(question, round.answers?.[question.slot], (slot, choice) => {
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
			drawScores(latest, day, current, quiz, choices,
				rankFor(config.ranks, before.correct).title !== rankFor(config.ranks, after.correct).title);
			return true;
		});
		card.id = `slide-${question.slot}`;
		card.setAttribute("aria-roledescription", "slide");
		card.querySelector("h3").tabIndex = -1;
		card.append(el("div"));
		return card;
	}));
	drawScores(state, day, round, quiz, round.answers);
	dom["question-carousel"].hidden = false;
	if (restoreFocus) dom.questions.children[active].querySelector("h3").focus({ preventScroll: true });
}

async function loadJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`Cannot load ${path}`);
	return response.json();
}

const deck = new URL("../v2/questions.json", import.meta.url);
const asset = (path) => path && new URL(path, deck).href;
function resolveAssets(question) {
	const { image, bench } = question;
	return {
		...question, read_more_url: asset(question.read_more_url),
		image: image && { ...image, crop_src: asset(image.crop_src), full_src: asset(image.full_src) },
		bench: bench && { ...bench, photo: asset(bench.photo), site_url: asset(bench.site_url), watchtalk_url: asset(bench.watchtalk_url) }
	};
}

dom.previous.addEventListener("click", () => selectQuestion(active - 1));
dom.next.addEventListener("click", () => selectQuestion(active + 1));
dom["question-carousel"].addEventListener("keydown", (event) => {
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
		event.target.closest("input, textarea, select, [contenteditable]")) return;
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	event.preventDefault();
	selectQuestion(active + (event.key === "ArrowRight" ? 1 : -1));
});
dom.questions.addEventListener("pointerdown", (event) => {
	suppressClick = false;
	if (event.pointerType === "touch" && event.isPrimary) gesture = event;
});
dom.questions.addEventListener("pointercancel", () => { gesture = null; });
dom.questions.addEventListener("pointerup", (event) => {
	if (!gesture || gesture.pointerId !== event.pointerId) return;
	const direction = swipeDirection(event.clientX - gesture.clientX, event.clientY - gesture.clientY);
	gesture = null;
	if (direction) {
		suppressClick = true;
		selectQuestion(active + direction);
	}
});
dom.questions.addEventListener("click", (event) => {
	if (suppressClick && event.detail) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}, true);

try {
	const [questions, settings] = await Promise.all([loadJson(deck), loadJson("../v2/config.json")]);
	config = settings;
	getRound = makeSchedule(questions.map(resolveAssets), settings);
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
