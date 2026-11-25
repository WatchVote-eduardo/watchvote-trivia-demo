import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dailyScore, questionsFor, totalsFor } from "./rounds.mjs";

const json = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url)));
const deck = json("./questions.json");

test("serves at least 14 distinct rounds, four distinct options per question, and cycles outside the schedule", () => {
	assert.ok(deck.days.length >= 14);
	const titles = new Set(json("../questions.json").map(({ title }) => title));
	for (const [day, questions] of deck.days.entries()) {
		assert.equal(questions.length, 4);
		const date = new Date(Date.parse(deck.startDate) + day * 86_400_000).toISOString().slice(0, 10);
		assert.equal(questionsFor(deck, date), questions);
		for (const [title, options, correct] of questions) {
			assert.ok(!titles.has(title));
			titles.add(title);
			assert.equal(new Set(options).size, 4);
			assert.ok(options[correct]);
		}
	}
	assert.equal(questionsFor(deck, "2026-12-09"), deck.days[0]);
	assert.equal(questionsFor(deck, "2026-11-24"), deck.days.at(-1));
});

test("totals count partial scores and streaks count finished days regardless of correctness", () => {
	const complete = [0, 0, 2, 3];
	const partial = { 0: 0, 2: 2 };
	const answers = { "2026-11-25": complete, "2026-11-26": complete, "2026-11-27": partial };
	assert.deepEqual(dailyScore(deck.days[2], partial), { played: 2, correct: 2 });
	assert.deepEqual(totalsFor(deck, answers, "2026-11-27"), { correct: 8, current: 2, best: 2 });
	assert.deepEqual(totalsFor(deck, answers, "2026-11-28"), { correct: 8, current: 0, best: 2 });
	answers["2026-11-28"] = [1, 2, 3, 0];
	assert.deepEqual(totalsFor(deck, answers, "2026-11-28"), { correct: 8, current: 1, best: 2 });
});
