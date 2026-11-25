import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { localDay, questionFor, scoreFor } from "./rounds.mjs";

const questions = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url)));

test("uses the local day and cycles the question deck across schedule boundaries", () => {
	assert.equal(localDay(new Date(2026, 10, 25, 23, 59)), questions[0].date);
	for (const question of questions) {
		assert.equal(questionFor(questions, question.date), question);
		assert.ok(question.options[question.correct]);
	}
	assert.equal(questionFor(questions, "2026-12-09"), questions[0]);
	assert.equal(questionFor(questions, "2026-11-24"), questions.at(-1));
});

test("missed or incorrect days reset current streak without erasing best streak", () => {
	const answers = { "2026-11-25": 1, "2026-11-26": 1 };
	assert.deepEqual(scoreFor(questions, answers, "2026-11-27"), { correct: 2, current: 2, best: 2 });
	assert.deepEqual(scoreFor(questions, { ...answers, "2026-11-27": 1 }, "2026-11-27"), { correct: 2, current: 0, best: 2 });
	assert.deepEqual(scoreFor(questions, answers, "2026-11-28"), { correct: 2, current: 0, best: 2 });
	assert.deepEqual(scoreFor(questions, { ...answers, "2026-11-28": 2 }, "2026-11-28"), { correct: 3, current: 1, best: 2 });
});
