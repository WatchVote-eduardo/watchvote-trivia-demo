export const levels = ["easy", "medium", "hard", "connoisseur"];
const dayMs = 86_400_000;

function dayNumber(date) {
	return Date.parse(date) / dayMs;
}

export function validDay(value) {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function gameDay(now, timeZone) {
	const parts = new Intl.DateTimeFormat("en", {
		timeZone, year: "numeric", month: "2-digit", day: "2-digit"
	}).formatToParts(now);
	const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return `${fields.year}-${fields.month}-${fields.day}`;
}

export function displayDay(date) {
	return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date));
}

function cycle(index, length) {
	return ((index % length) + length) % length;
}

export function makeSchedule(questions, config) {
	const dated = new Map();
	for (const question of questions) {
		if (!dated.has(question.date)) dated.set(question.date, []);
		dated.get(question.date).push(question);
	}
	const days = [...dated.keys()].sort();
	for (const day of days) {
		const round = dated.get(day).sort((a, b) => a.slot - b.slot);
		if (round.length !== 4 || round.some((question, index) => question.slot !== index + 1)) {
			throw new Error(`Invalid round for ${day}`);
		}
	}
	const imagePool = questions.filter((question) => question.type === "image");
	const benchPool = questions.filter((question) => question.bench);
	const normal = levels.map((_, index) => questions.find((q) => q.slot === index + 1 && q.type === "text" && !q.bench));
	return (date) => {
		const offset = dayNumber(date) - dayNumber(days[0]);
		const base = dated.get(date) || dated.get(days[cycle(offset, days.length)]);
		const weekday = new Date(date).getUTCDay();
		return base.map((question, index) => {
			let selected = question;
			if (weekday === config.bench_day && index === 3 && benchPool.length) {
				selected = question.bench ? question : benchPool[cycle(Math.floor(offset / 7), benchPool.length)];
			} else if (weekday === config.picture_day && index === config.picture_slot - 1 && imagePool.length) {
				selected = question.type === "image" ? question : imagePool[cycle(Math.floor(offset / 7), imagePool.length)];
			} else if (question.bench || question.type === "image") {
				selected = normal[index];
			}
			return { ...selected, slot: index + 1, level: levels[index] };
		});
	};
}

export function resultsFor(questions, answers) {
	return questions.map((question) => {
		const choice = answers?.[question.slot];
		if (!Number.isInteger(choice) || !Object.hasOwn(question.options, choice)) return "-";
		return choice === question.correct_index ? "1" : "0";
	}).join("");
}

export function summarize(results) {
	return {
		played: [...results].filter((result) => result !== "-").length,
		correct: [...results].filter((result) => result === "1").length
	};
}

export function scoreHistory(getRound, history, today) {
	let correct = 0, run = 0, best = 0, previous = -Infinity;
	for (const date of Object.keys(history).sort()) {
		if (!validDay(date) || date > today) continue;
		const score = summarize(resultsFor(getRound(date), history[date]));
		if (!score.played) continue;
		correct += score.correct;
		const day = dayNumber(date);
		run = day === previous + 1 ? run + 1 : 1;
		best = Math.max(best, run);
		previous = day;
	}
	return { correct, current: previous >= dayNumber(today) - 1 ? run : 0, best };
}

export function rankFor(ranks, correct) {
	const next = ranks.findIndex((rank) => rank.min_correct > correct);
	return next < 0 ? { title: ranks.at(-1).title, next: null } :
		{ title: ranks[next - 1].title, next: ranks[next].title, remaining: ranks[next].min_correct - correct };
}

export function communityFor(votes, choice) {
	const counts = votes.map((count, index) => count + Number(index === choice));
	const total = counts.reduce((sum, count) => sum + count, 0);
	const exact = counts.map((count) => count * 100 / total);
	const percentages = exact.map(Math.floor);
	const remaining = 100 - percentages.reduce((sum, value) => sum + value, 0);
	const priority = exact.map((value, index) => ({ index, fraction: value - percentages[index] }))
		.sort((a, b) => b.fraction - a.fraction);
	for (const { index } of priority.slice(0, remaining)) percentages[index] += 1;
	return percentages;
}

export function resultSquares(results) {
	return results.replaceAll("1", "🟩").replaceAll("0", "🟥").replaceAll("-", "⬜");
}

export function shareText({ date, results, streak, shareUrl, bench }) {
	return [
		`WatchVote Daily Trivia · ${displayDay(date)}`,
		`${resultSquares(results)}  ${summarize(results).correct}/4`,
		`Streak: ${streak} ${streak === 1 ? "day" : "days"}`,
		...(bench ? [`Bench question by ${bench}`] : []),
		shareUrl
	].join("\n");
}

export function challengeFrom(url) {
	const date = url.searchParams.get("round");
	const results = url.searchParams.get("result");
	const name = url.searchParams.get("name")?.trim().slice(0, 40);
	return validDay(date) && /^[01]{4}$/.test(results) && name ? { date, results, name } : null;
}

export function challengeUrl(base, { date, results, name }) {
	const url = new URL("./", base);
	url.search = new URLSearchParams({ round: date, name: name.trim().slice(0, 40) || "A collector", result: results });
	return url.href;
}
