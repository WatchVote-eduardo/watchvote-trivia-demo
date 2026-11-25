import { localDay } from "../rounds.mjs";
import { dailyScore, questionsFor, totalsFor } from "./rounds.mjs";

const storageKey = "watchvote-four-a-day-v1";
const progress = document.querySelector("#progress");
const dateLabel = document.querySelector("#round-date");
const cards = document.querySelector("#questions");
const boards = document.querySelector("#boards");
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
const samplePlayers = [
	{ name: "Maya", correct: 24, current: 2, best: 4 },
	{ name: "Alex", correct: 16, current: 3, best: 3 },
	{ name: "Jordan", correct: 11, current: 0, best: 2 },
];
let answers = {};
let storageAvailable = true;
let renderedDay;

function element(tag, classes, text) {
	const node = document.createElement(tag);
	if (classes) node.className = classes;
	if (text !== undefined) node.textContent = text;
	return node;
}

function readAnswers() {
	if (!storageAvailable) return answers;
	try {
		const stored = JSON.parse(localStorage.getItem(storageKey));
		return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
	} catch {
		return answers;
	}
}

function isChoice(choice, options) {
	return Number.isInteger(choice) && choice >= 0 && choice < options.length;
}

function orderedOptions(title, options) {
	const hash = [...title].reduce((value, char) => (Math.imul(value, 31) + char.codePointAt(0)) >>> 0, 0);
	return options.map((_, position) => {
		const index = (position + hash) % options.length;
		return { index, letter: String.fromCharCode(65 + position), text: options[index] };
	});
}

function optionContent({ letter, text }) {
	return [element("span", "wv-trivia__letter", letter), element("span", "wv-trivia__option-text", text)];
}

function renderReview(ordered, correct, choice, container, focus) {
	const isCorrect = choice === correct;
	const correctText = ordered.find(({ index }) => index === correct).text;
	const result = element("p", "wv-trivia__feedback",
		`${isCorrect ? "Correct! The answer is" : "Not quite. The correct answer is"} ${correctText}.`);
	if (!isCorrect) result.classList.add("wv-trivia__feedback--incorrect");
	result.tabIndex = -1;
	const list = element("ul", "wv-trivia__review");
	list.setAttribute("role", "list");
	for (const option of ordered) {
		const item = element("li", "wv-trivia__option");
		item.append(...optionContent(option));
		if (option.index === correct || option.index === choice) {
			item.classList.add(option.index === correct ? "wv-trivia__option--correct" : "wv-trivia__option--incorrect");
			const badge = option.index !== choice ? "Correct answer" : isCorrect ? "Your answer · Correct" : "Your answer";
			item.append(element("span", "wv-trivia__badge", badge));
		}
		list.append(item);
	}
	container.replaceChildren(result, list, element("p", "wv-trivia__hint", "Your answer is locked in."));
	if (focus) result.focus();
}

function buildQuestion(question, number, choice, onAnswer) {
	const [title, options, correct] = question;
	const ordered = orderedOptions(title, options);
	const card = element("section", "wv-trivia__card four-question");
	const heading = element("h3", "", title);
	heading.id = `question-${number}`;
	card.setAttribute("aria-labelledby", heading.id);
	const content = element("div");
	card.append(element("p", "wv-trivia__eyebrow", `Question ${number} of 4`), heading, content);
	if (isChoice(choice, options)) {
		renderReview(ordered, correct, choice, content, false);
		return card;
	}
	const form = element("form");
	const fieldset = element("fieldset");
	fieldset.append(element("legend", "wv-trivia__legend", "Choose one answer"));
	for (const option of ordered) {
		const radio = element("input");
		radio.type = "radio";
		radio.name = `choice-${number}`;
		radio.required = true;
		radio.value = option.index;
		const label = element("label", "wv-trivia__option");
		label.append(radio, ...optionContent(option));
		fieldset.append(label);
	}
	const submit = element("button", "wv-trivia__button", "Submit answer");
	submit.type = "submit";
	form.append(fieldset, submit);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const selected = form.querySelector("input:checked");
		if (selected && onAnswer(Number(selected.value))) {
			renderReview(ordered, correct, Number(selected.value), content, true);
		}
	});
	content.append(form);
	return card;
}

function buildBoard(players, title, description, fields, labels) {
	const sorted = [...players].sort((a, b) => (
		b[fields[0]] - a[fields[0]] || b[fields[1]] - a[fields[1]] || a.name.localeCompare(b.name)
	));
	const board = element("section", "wv-trivia__card wv-trivia__board");
	const wrap = element("div", "wv-trivia__table-wrap");
	const table = element("table");
	table.setAttribute("aria-label", title);
	const header = table.createTHead().insertRow();
	["Rank", "Player", ...labels].forEach((label, index) => {
		const th = element("th", `wv-trivia__col-${["rank", "player"][index] || "num"}`, label);
		th.scope = "col";
		header.append(th);
	});
	const body = table.createTBody();
	let rank = 0;
	let previous;
	sorted.forEach((player, index) => {
		const values = fields.slice(0, labels.length).map((key) => player[key]);
		const score = values.join(",");
		if (score !== previous) rank = index + 1;
		previous = score;
		const row = body.insertRow();
		if (player.name === "You") row.className = "wv-trivia__row--current";
		const name = element("th", "wv-trivia__col-player", player.name);
		name.scope = "row";
		row.append(element("td", "wv-trivia__col-rank", rank), name,
			...values.map((value) => element("td", "wv-trivia__col-num", value)));
	});
	wrap.append(table);
	board.append(element("h3", "", title), element("p", "wv-trivia__board-description", description), wrap);
	return board;
}

function renderScores(deck, questions, day) {
	const { played, correct } = dailyScore(questions, answers[day]);
	progress.textContent = `${played}/4 answered · ${correct}/4 correct${played === 4 ? " · Round complete" : ""}`;
	const players = [...samplePlayers, { name: "You", ...totalsFor(deck, answers, day) }];
	boards.replaceChildren(
		buildBoard(players, "Most correct answers", "Every correct answer counts.", ["correct", "current"], ["Correct"]),
		buildBoard(players, "Streak leaderboard", "A day counts when all four questions are answered, right or wrong.",
			["current", "best"], ["Current", "Best"])
	);
}

function render(deck) {
	const day = localDay();
	renderedDay = day;
	answers = readAnswers();
	const questions = questionsFor(deck, day);
	dateLabel.dateTime = day;
	dateLabel.textContent = dateFormat.format(new Date(day));
	cards.replaceChildren(...questions.map((question, index) => buildQuestion(question, index + 1, answers[day]?.[index], (choice) => {
		answers = readAnswers();
		if (localDay() !== day || isChoice(answers[day]?.[index], question[1])) {
			render(deck);
			return false;
		}
		answers[day] = { ...answers[day], [index]: choice };
		try {
			if (storageAvailable) localStorage.setItem(storageKey, JSON.stringify(answers));
		} catch {
			storageAvailable = false;
		}
		renderScores(deck, questions, day);
		return true;
	})));
	renderScores(deck, questions, day);
}

try {
	const response = await fetch("./questions.json");
	if (!response.ok) throw new Error();
	const deck = await response.json();
	render(deck);
	window.addEventListener("storage", (event) => {
		if (event.key === storageKey || event.key === null) render(deck);
	});
	setInterval(() => {
		if (localDay() !== renderedDay) render(deck);
	}, 1000);
} catch {
	progress.textContent = "Today’s questions couldn’t load. Refresh to try again.";
}
