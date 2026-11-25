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

export function summaryAvailable(results) {
	return results.endsWith("1") || results.endsWith("0");
}

export function nearestSlide(centers, viewportCenter) {
	return centers.reduce((closest, center, index) =>
		Math.abs(center - viewportCenter) < Math.abs(centers[closest] - viewportCenter) ? index : closest, 0);
}
