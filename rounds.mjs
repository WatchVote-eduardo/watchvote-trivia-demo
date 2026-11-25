const dayMs = 86_400_000;

export function localDay(now = new Date()) {
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

function dayNumber(date) {
	return Date.parse(date) / dayMs;
}

export function questionFor(questions, date) {
	const scheduled = questions.find((question) => question.date === date);
	if (scheduled) return scheduled;
	const offset = dayNumber(date) - dayNumber(questions[0].date);
	const index = ((offset % questions.length) + questions.length) % questions.length;
	return questions[index];
}

export function scoreFor(questions, answers, today) {
	const correctDays = Object.keys(answers).filter((date) => (
		/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today &&
		answers[date] === questionFor(questions, date)?.correct
	)).sort().map(dayNumber);
	let run = 0;
	let best = 0;
	let previous = -Infinity;
	for (const day of correctDays) {
		run = day === previous + 1 ? run + 1 : 1;
		best = Math.max(best, run);
		previous = day;
	}
	const current = previous === dayNumber(today) ||
		(!Object.hasOwn(answers, today) && previous === dayNumber(today) - 1) ? run : 0;
	return { correct: correctDays.length, current, best };
}
