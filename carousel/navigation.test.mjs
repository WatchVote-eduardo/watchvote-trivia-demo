import assert from "node:assert/strict";
import test from "node:test";
import { firstUnanswered, nearestSlide, nextAction, summaryAvailable } from "./navigation.mjs";

test("resumes at the first unanswered question or the final review", () => {
	assert.equal(firstUnanswered("----"), 0);
	assert.equal(firstUnanswered("10-1"), 2);
	assert.equal(firstUnanswered("1001"), 3);
});

test("only a locked card offers the next question, unfinished question, or summary", () => {
	assert.equal(nextAction("1---", 1), null);
	assert.deepEqual(nextAction("1---", 0), { label: "Next question", index: 1 });
	assert.deepEqual(nextAction("10-1", 3), { label: "Go to first unanswered", index: 2 });
	assert.deepEqual(nextAction("1001", 3), { label: "View round summary" });
});

test("the fifth slide is available as soon as question four is answered", () => {
	assert.equal(summaryAvailable("111-"), false);
	assert.equal(summaryAvailable("---0"), true);
	assert.equal(summaryAvailable("---1"), true);
});

test("selects the slide closest to the viewport center, including the summary", () => {
	const centers = [165.5, 462.3, 759.1, 1055.9, 1352.7];
	assert.equal(nearestSlide(centers, 165.5), 0);
	assert.equal(nearestSlide(centers, 620), 2);
	assert.equal(nearestSlide(centers, 1352), 4);
	assert.equal(nearestSlide(centers.slice(0, 4), 1352), 3);
});
