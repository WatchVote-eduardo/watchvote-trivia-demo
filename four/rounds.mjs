const dayMs = 86_400_000;

function dayNumber(date) {
	return Date.parse(date) / dayMs;
}

export function questionsFor(deck, date) {
	const offset = dayNumber(date) - dayNumber(deck.startDate);
	const index = ((offset % deck.days.length) + deck.days.length) % deck.days.length;
	return deck.days[index];
}

export function dailyScore(questions, choices) {
	return questions.reduce((result, [, options, correct], index) => {
		const choice = choices?.[index];
		if (Number.isInteger(choice) && choice >= 0 && choice < options.length) {
			result.played += 1;
			if (choice === correct) result.correct += 1;
		}
		return result;
	}, { played: 0, correct: 0 });
}

export function totalsFor(deck, answers, today) {
	let correct = 0;
	let run = 0;
	let best = 0;
	let previous = -Infinity;
	for (const date of Object.keys(answers).sort()) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) continue;
		const questions = questionsFor(deck, date);
		if (!questions) continue;
		const score = dailyScore(questions, answers[date]);
		correct += score.correct;
		if (score.played !== questions.length) continue;
		const day = dayNumber(date);
		run = day === previous + 1 ? run + 1 : 1;
		best = Math.max(best, run);
		previous = day;
	}
	const current = previous >= dayNumber(today) - 1 ? run : 0;
	return { correct, current, best };
}
