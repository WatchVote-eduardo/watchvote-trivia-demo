import { communityFor, rankFor, summarize } from "./model.mjs";

export function el(tag, classes, text) {
	const node = document.createElement(tag);
	if (classes) node.className = classes;
	if (text !== undefined) node.textContent = text;
	return node;
}

export function link(text, url, classes) {
	const anchor = el("a", classes, text);
	anchor.href = url;
	return anchor;
}

export function button(label, onClick) {
	const control = el("button", "wv-trivia__button", label);
	control.type = "button";
	if (onClick) control.addEventListener("click", onClick);
	return control;
}

function optionText(text, index) {
	return [
		el("span", "wv-trivia__letter", String.fromCharCode(65 + index)),
		el("span", "wv-trivia__option-text", text)
	];
}

function picture(image, revealed) {
	const figure = el("figure", "v2-picture");
	const img = el("img");
	img.loading = "lazy";
	img.decoding = "async";
	img.width = 360;
	img.height = 360;
	img.src = revealed ? image.full_src : image.crop_src;
	img.alt = revealed ? "Full illustration of the fictional watch" : "Close-up of watch hands, dial and part of the outer scale";
	figure.append(img, el("figcaption", "", image.credit));
	return figure;
}

function benchHeader(bench) {
	const header = el("header", "v2-bench paired-feature");
	const image = el("img");
	image.src = bench.photo;
	image.width = 80;
	image.height = 80;
	image.loading = "lazy";
	image.alt = "Illustrated portrait of a fictional watchmaker";
	const bio = el("div");
	bio.append(el("p", "wv-trivia__eyebrow", "Question from the Bench"),
		el("strong", "", bench.name), el("p", "", `${bench.brand} · ${bench.city}`));
	if (bench.site_url) bio.append(link("Watchmaker’s site", bench.site_url));
	if (bench.watchtalk_url) bio.append(document.createTextNode(" "), link("WatchTalks episode", bench.watchtalk_url));
	header.append(image, bio);
	return header;
}

function review(question, choice) {
	const correct = choice === question.correct_index;
	const verdict = correct ? "Correct!" : "Not quite.";
	const outcome = el("p", `wv-trivia__feedback${correct ? "" : " wv-trivia__feedback--incorrect"}`,
		`${verdict} The answer is ${question.options[question.correct_index]}.`);
	outcome.tabIndex = -1;
	const explanation = el("div", "v2-explanation");
	explanation.append(el("p", "", question.explanation));
	if (question.bench) explanation.append(el("p", "v2-signature", `— ${question.bench.name}`));
	if (question.read_more_url) explanation.append(link("Read more on WatchVote", question.read_more_url, "v2-reading"));
	const percentages = communityFor(question.votes, choice);
	const community = el("p", "v2-community", `${percentages[question.correct_index]}% of collectors got this right.`);
	const list = el("ul", "wv-trivia__review paired-review");
	list.setAttribute("role", "list");
	question.options.forEach((text, index) => {
		const isCorrect = index === question.correct_index;
		const item = el("li", "wv-trivia__option");
		item.append(...optionText(text, index));
		if (isCorrect || index === choice) {
			item.classList.add(isCorrect ? "wv-trivia__option--correct" : "wv-trivia__option--incorrect");
			const badge = index === choice ? (isCorrect ? "Your answer · Correct" : "Your answer") : "Correct answer";
			item.append(el("span", "wv-trivia__badge", badge));
		}
		const bar = el("span", "v2-bar");
		bar.setAttribute("aria-hidden", "true");
		const fill = el("span");
		fill.style.width = `${percentages[index]}%`;
		bar.append(fill);
		const poll = el("span", "v2-poll");
		poll.append(bar, el("span", "", `${percentages[index]}%`));
		item.append(poll);
		list.append(item);
	});
	const nodes = [outcome, explanation];
	if (question.image) nodes.push(picture(question.image, true));
	nodes.push(community, list, el("p", "wv-trivia__hint", "Your answer is locked in."));
	return nodes;
}

export function questionCard(question, savedChoice, submit) {
	const isLocked = Number.isInteger(savedChoice) && Object.hasOwn(question.options, savedChoice);
	const { slot, level } = question;
	const card = el("section", `wv-trivia__card v2-question paired-question${level === "connoisseur" ? " v2-connoisseur" : ""}`);
	const label = el("p", "wv-trivia__eyebrow", `Question ${slot} of 4 `);
	label.append(el("span", "v2-level", level.toUpperCase()));
	const title = el("h3", "", question.prompt);
	title.id = `question-${slot}`;
	card.setAttribute("aria-labelledby", title.id);
	card.append(label);
	if (question.bench) card.append(benchHeader(question.bench));
	if (question.image) card.append(el("p", "wv-trivia__eyebrow paired-feature", "Name That Watch"));
	card.append(title);
	const body = el("div", "paired-body");
	card.append(body);
	const reveal = (choice, focus) => {
		const nodes = review(question, choice);
		body.replaceChildren(...nodes);
		if (focus) nodes[0].focus();
	};
	if (isLocked) {
		reveal(savedChoice, false);
		return card;
	}
	if (question.image) body.append(picture(question.image, false));
	const form = el("form", "paired-form");
	const legend = el("p", "wv-trivia__legend", "Choose one answer");
	legend.id = `choices-${slot}`;
	const optionsGroup = el("div", "paired-options");
	optionsGroup.setAttribute("role", "radiogroup");
	optionsGroup.setAttribute("aria-labelledby", legend.id);
	question.options.forEach((text, index) => {
		const option = el("label", "wv-trivia__option");
		const input = el("input");
		input.type = "radio";
		input.name = `choice-${slot}`;
		input.value = index;
		input.required = true;
		option.append(input, ...optionText(text, index));
		optionsGroup.append(option);
	});
	const save = button("Submit answer");
	save.type = "submit";
	form.append(legend, optionsGroup, save);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const selected = form.querySelector("input:checked");
		if (selected && submit(slot, Number(selected.value))) reveal(Number(selected.value), true);
	});
	body.append(form);
	return card;
}

export function leaderboard(players, ranks, streak) {
	const title = streak ? "Streak leaderboard" : "Most correct answers";
	const description = streak ? "Playing at least one question counts toward a streak." : "Ranked by all-time correct answers.";
	const fields = streak ? ["current", "best"] : ["correct"];
	const sorted = [...players].sort((a, b) => (
		b[fields[0]] - a[fields[0]] || (streak ? b.best - a.best : 0) || a.name.localeCompare(b.name)
	));
	const board = el("section", "wv-trivia__card wv-trivia__board");
	const wrap = el("div", "wv-trivia__table-wrap");
	const table = el("table");
	table.setAttribute("aria-label", title);
	const head = table.createTHead().insertRow();
	["Rank", "Player", "Title", ...(streak ? ["Current", "Best"] : ["Correct"])].forEach((label, index) => {
		const th = el("th", `wv-trivia__col-${["rank", "player", "player"][index] || "num"}`, label);
		th.scope = "col";
		head.append(th);
	});
	const body = table.createTBody();
	let rank = 0;
	let previous;
	sorted.forEach((player, index) => {
		const values = fields.map((field) => player[field]);
		const signature = values.join(",");
		if (signature !== previous) rank = index + 1;
		previous = signature;
		const row = body.insertRow();
		if (player.you) row.className = "wv-trivia__row--current";
		const name = el("th", "wv-trivia__col-player", player.name);
		name.scope = "row";
		row.append(el("td", "wv-trivia__col-rank", rank), name,
			el("td", "v2-title-cell", rankFor(ranks, player.correct).title),
			...values.map((value) => el("td", "wv-trivia__col-num", value)));
	});
	wrap.append(table);
	board.append(el("h3", "", title), el("p", "wv-trivia__board-description", description), wrap);
	return board;
}

export function comparison(challenge, results) {
	const section = el("section", "wv-trivia__card v2-social v2-challenge-results");
	section.append(el("h3", "", "Challenge results"));
	const table = el("table", "v2-comparison");
	const header = table.createTHead().insertRow();
	for (const title of ["Question", challenge.name, "You"]) {
		const cell = el("th", "", title);
		cell.scope = "col";
		header.append(cell);
	}
	const body = table.createTBody();
	function row(label, first, second) {
		const heading = el("th", "", label);
		heading.scope = "row";
		body.insertRow().append(heading, el("td", "", first), el("td", "", second));
	}
	const word = (result) => result === "1" ? "Correct" : "Wrong";
	for (let i = 0; i < 4; i += 1) row(i + 1, word(challenge.results[i]), word(results[i]));
	row("Score", `${summarize(challenge.results).correct}/4`, `${summarize(results).correct}/4`);
	section.append(table);
	return section;
}
