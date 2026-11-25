import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { challengeFrom, challengeUrl, communityFor, gameDay, makeSchedule, rankFor, resultsFor, scoreHistory, shareText, validDay } from "./model.mjs";

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const questions = load("./questions.json");
const config = load("./config.json");
const getRound = makeSchedule(questions, config);

test("the deck contains fourteen complete rounds with four unique choices and valid artwork", () => {
	assert.equal(new Set(questions.map((question) => question.date)).size, 14);
	assert.equal(new Set(questions.map((question) => question.id)).size, 56);
	for (const question of questions) {
		assert.equal(new Set(question.options).size, 4);
		assert.ok(Object.hasOwn(question.options, question.correct_index));
		for (const path of [question.image?.crop_src, question.image?.full_src, question.bench?.photo, question.read_more_url].filter(Boolean)) {
			assert.ok(readFileSync(new URL(path, import.meta.url)).length);
		}
	}
	assert.deepEqual(getRound("2026-11-25"), getRound("2026-12-09"));
});

test("Miami calendar rolls over at midnight in standard and daylight time", () => {
	assert.equal(gameDay(new Date("2026-11-25T04:59:59Z"), config.time_zone), "2026-11-24");
	assert.equal(gameDay(new Date("2026-11-25T05:00:00Z"), config.time_zone), "2026-11-25");
	assert.equal(gameDay(new Date("2026-07-04T03:59:59Z"), config.time_zone), "2026-07-03");
	assert.equal(gameDay(new Date("2026-07-04T04:00:00Z"), config.time_zone), "2026-07-04");
	assert.equal(validDay("2026-02-31"), false);
});

test("week cycles four difficulty levels and allows configuring picture and bench placement", () => {
	assert.deepEqual(getRound("2026-11-25").map((entry) => entry.level), ["easy", "medium", "hard", "connoisseur"]);
	assert.equal(getRound("2026-11-25")[1].type, "image");
	assert.ok(getRound("2026-11-27")[3].bench);
	assert.equal(getRound("2026-12-02")[1].type, "image");
	const alternate = makeSchedule(questions, { ...config, picture_day: 4, picture_slot: 3, bench_day: 6 });
	assert.ok(alternate("2026-11-25").every((q) => q.type === "text"));
	assert.equal(alternate("2026-11-26")[2].type, "image");
	assert.equal(alternate("2026-11-27")[3].bench, null);
	assert.ok(alternate("2026-11-28")[3].bench);
});

test("wrong or right first answers count as played; missing an entire day breaks current streak", () => {
	const history = { "2026-11-25": { 1: 0 }, "2026-11-26": { 1: 0 }, "2026-11-29": { 2: 2 } };
	assert.equal(resultsFor(getRound("2026-11-26"), history["2026-11-26"]), "0---");
	assert.deepEqual(scoreHistory(getRound, history, "2026-11-27"), { correct: 1, current: 2, best: 2 });
	assert.deepEqual(scoreHistory(getRound, history, "2026-11-28"), { correct: 1, current: 0, best: 2 });
	assert.deepEqual(scoreHistory(getRound, history, "2026-11-29"), { correct: 2, current: 1, best: 2 });
});

test("rank thresholds can be changed and every boundary promotes the player", () => {
	config.ranks.slice(1).forEach((rank, index) => {
		const prior = rankFor(config.ranks, rank.min_correct - 1);
		assert.equal(prior.title, config.ranks[index].title);
		assert.equal(prior.remaining, 1);
		assert.equal(rankFor(config.ranks, rank.min_correct).title, rank.title);
	});
	assert.equal(rankFor(config.ranks, 700).next, null);
});

test("one local vote nudges the seeded percentages without rounding errors", () => {
	assert.deepEqual(communityFor([0, 100, 0, 0], 3), [0, 99, 0, 1]);
	assert.equal(communityFor([1, 1, 1, 1], 0).reduce((a,b) => a + b), 100);
});

test("share and challenge payloads include outcomes, never selected options", () => {
	const date = "2026-11-27";
	assert.equal(shareText({ date, results: "10--", streak: 1, shareUrl: config.share_url, bench: "Mira Pinwheel" }),
		"WatchVote Daily Trivia · Nov 27, 2026\n🟩🟥⬜⬜  1/4\nStreak: 1 day\nBench question by Mira Pinwheel\nwatchvote.com/trivia");
	const base = "https://example.test/demo/v2/?date=2026-11-27";
	const link = new URL(challengeUrl(base, { date, name: " Demi & Jo ", results: "1101" }));
	assert.equal(link.pathname, "/demo/v2/");
	assert.equal(link.searchParams.has("date"), false);
	assert.deepEqual(challengeFrom(link), { date, name: "Demi & Jo", results: "1101" });
	link.searchParams.set("result", "choice3");
	assert.equal(challengeFrom(link), null);
});
