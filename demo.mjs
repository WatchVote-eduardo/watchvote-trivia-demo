import { localDay, questionFor, scoreFor } from "./rounds.mjs";

const storageKey = "watchvote-static-trivia-v1";
const title = document.querySelector("#question-title");
const dateLabel = document.querySelector("#question-date");
const choices = document.querySelector("#choices");
const boards = document.querySelector("#boards");
const samplePlayers = [
	{ name: "Maya", correct: 7, current: 2, best: 4 },
	{ name: "Alex", correct: 5, current: 3, best: 3 },
	{ name: "Jordan", correct: 3, current: 0, best: 2 },
];
let answers = {};
let renderedDay;
let storageAvailable = true;

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

function optionText(option, index) {
	return [
		element("span", "wv-trivia__letter", String.fromCharCode(65 + index)),
		element("span", "wv-trivia__option-text", option),
	];
}

function review(question, answer) {
	const correct = answer === question.correct;
	const feedback = correct ? "Correct! The answer is" : "Not quite. The correct answer is";
	const outcome = element("p", "wv-trivia__feedback", `${feedback} ${question.options[question.correct]}.`);
	if (!correct) outcome.classList.add("wv-trivia__feedback--incorrect");
	outcome.setAttribute("role", "status");
	outcome.tabIndex = -1;
	const options = element("ul", "wv-trivia__review");
	options.setAttribute("role", "list");
	question.options.forEach((text, index) => {
		const li = element("li", "wv-trivia__option");
		li.append(...optionText(text, index));
		if (index === question.correct || index === answer) {
			li.classList.add(index === question.correct ? "wv-trivia__option--correct" : "wv-trivia__option--incorrect");
			const badge = index === answer ? (correct ? "Your answer · Correct" : "Your answer") : "Correct answer";
			li.append(element("span", "wv-trivia__badge", badge));
		}
		options.append(li);
	});
	choices.replaceChildren(outcome, element("h4", "wv-trivia__legend", "Answer review"), options,
		element("p", "wv-trivia__hint", "Your answer is locked in. Come back for the next question."));
	return outcome;
}

function answerForm(question, onAnswer) {
	const form = element("form");
	const fieldset = element("fieldset");
	fieldset.append(element("legend", "wv-trivia__legend", "Choose one answer"));
	question.options.forEach((text, index) => {
		const label = element("label", "wv-trivia__option");
		const input = element("input");
		input.type = "radio";
		input.name = "choice";
		input.value = index;
		input.required = true;
		label.append(input, ...optionText(text, index));
		fieldset.append(label);
	});
	const submit = element("button", "wv-trivia__button", "Submit answer");
	submit.type = "submit";
	form.append(fieldset, submit);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const selected = new FormData(form).get("choice");
		if (selected !== null) onAnswer(Number(selected));
	});
	choices.replaceChildren(form);
}

function buildBoard(players, streak) {
	const title = streak ? "Streak leaderboard" : "Most correct answers";
	const description = streak ? "Current is your active run. Best is your longest run." : "Ranked by total correct answers.";
	const columns = streak ? ["Current", "Best"] : ["Correct"];
	const fields = streak ? ["current", "best"] : ["correct"];
	const sorted = [...players].sort((a, b) => (
		b[fields[0]] - a[fields[0]] || b[streak ? "best" : "current"] - a[streak ? "best" : "current"] ||
		a.name.localeCompare(b.name)
	));
	const board = element("section", "wv-trivia__card wv-trivia__board");
	const tableWrap = element("div", "wv-trivia__table-wrap");
	const table = element("table");
	table.setAttribute("aria-label", title);
	const header = table.createTHead().insertRow();
	["Rank", "Player", ...columns].forEach((label, index) => {
		const cell = element("th", `wv-trivia__col-${["rank", "player"][index] || "num"}`, label);
		cell.scope = "col";
		header.append(cell);
	});
	const body = table.createTBody();
	let rank = 0;
	let previous;
	sorted.forEach((player, index) => {
		const values = fields.map((field) => player[field]);
		if (values.join() !== previous) rank = index + 1;
		previous = values.join();
		const row = body.insertRow();
		if (player.name === "You") row.className = "wv-trivia__row--current";
		const name = element("th", "wv-trivia__col-player", player.name);
		name.scope = "row";
		row.append(element("td", "wv-trivia__col-rank", rank), name,
			...values.map((value) => element("td", "wv-trivia__col-num", value)));
	});
	tableWrap.append(table);
	board.append(element("h3", "", title), element("p", "wv-trivia__board-description", description), tableWrap);
	return board;
}

function render(questions, focusResult = false) {
	const day = localDay();
	renderedDay = day;
	answers = readAnswers();
	const question = questionFor(questions, day);
	dateLabel.dateTime = day;
	dateLabel.textContent = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(day));
	title.textContent = question.title;
	const previous = answers[day];
	if (Number.isInteger(previous) && previous >= 0 && previous < question.options.length) {
		const result = review(question, previous);
		if (focusResult) result.focus();
	} else {
		answerForm(question, (choice) => {
			if (localDay() !== day) return render(questions);
			answers = readAnswers();
			if (Object.hasOwn(answers, day)) return render(questions);
			answers[day] = choice;
			try {
				localStorage.setItem(storageKey, JSON.stringify(answers));
			} catch {
				storageAvailable = false;
			}
			render(questions, true);
		});
	}
	const players = [...samplePlayers, { name: "You", ...scoreFor(questions, answers, day) }];
	boards.replaceChildren(buildBoard(players, false), buildBoard(players, true));
}

try {
	const response = await fetch("./questions.json");
	if (!response.ok) throw new Error();
	const questions = await response.json();
	if (!Array.isArray(questions) || questions.length === 0) throw new Error();
	render(questions);
	window.addEventListener("storage", (event) => {
		if (event.key === storageKey || event.key === null) render(questions);
	});
	setInterval(() => {
		if (localDay() !== renderedDay) render(questions);
	}, 1000);
} catch {
	title.textContent = "Today’s question couldn’t load. Refresh to try again.";
}
