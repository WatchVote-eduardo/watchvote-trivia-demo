import assert from "node:assert/strict";
import test from "node:test";
import { firstUnanswered, nextAction, swipeDirection, swipeIntent } from "./navigation.mjs";

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

test("recognizes deliberate horizontal swipes but not taps, diagonal motion or scrolling", () => {
	assert.equal(swipeIntent(6, 5), null);
	assert.equal(swipeIntent(-16, 8), "horizontal");
	assert.equal(swipeIntent(18, 18), "vertical");
	assert.equal(swipeDirection(-110, 15), 1);
	assert.equal(swipeDirection(110, 15), -1);
	assert.equal(swipeDirection(47, 0), 0);
	assert.equal(swipeDirection(60, -55), 0);
	assert.equal(swipeDirection(-60, 100), 0);
});
