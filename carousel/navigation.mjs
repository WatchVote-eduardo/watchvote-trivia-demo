export function firstUnanswered(results) {
	const index = results.indexOf("-");
	return index < 0 ? results.length - 1 : index;
}

export function nextAction(results, active) {
	if (results[active] === "-") return null;
	if (active < results.length - 1) return { label: "Next question", index: active + 1 };
	if (results.includes("-")) return { label: "Go to first unanswered", index: firstUnanswered(results) };
	return { label: "View round summary" };
}

export function swipeIntent(dx, dy) {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
	return Math.abs(dx) > 1.4 * Math.abs(dy) ? "horizontal" : "vertical";
}

export function swipeDirection(dx, dy) {
	if (Math.abs(dx) < 48 || swipeIntent(dx, dy) !== "horizontal") return 0;
	return dx < 0 ? 1 : -1;
}
