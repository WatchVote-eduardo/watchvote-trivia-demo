import { challengeUrl, displayDay, shareText, summarize } from "./model.mjs";
import { button, el } from "./view.mjs";

async function downloadImage(data) {
	await Promise.all([
		document.fonts.load('700 82px "WatchVote Cormorant"'),
		document.fonts.load('500 42px "WatchVote Jost"'),
		document.fonts.load('700 38px "WatchVote Jost"')
	]);
	const canvas = el("canvas");
	canvas.width = 1080;
	canvas.height = 1920;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#f8f3ef";
	ctx.fillRect(0, 0, 1080, 1920);
	ctx.fillStyle = "#0e152a";
	ctx.fillRect(0, 0, 1080, 340);
	ctx.fillRect(0, 1680, 1080, 240);
	ctx.textAlign = "center";
	function text(value, y, size, color = "#0e152a", serif = false) {
		ctx.fillStyle = color;
		ctx.font = `700 ${size}px "${serif ? "WatchVote Cormorant" : "WatchVote Jost"}", serif`;
		ctx.fillText(value, 540, y, 920);
	}
	text("WATCHVOTE", 175, 92, "#ffffff", true);
	text("BY COLLECTORS", 236, 32, "#ebddcf");
	text("Daily Trivia", 560, 100, "#0e152a", true);
	text(displayDay(data.date), 654, 42, "#855521");
	const colors = { "1": "#4e8350", "0": "#a35143", "-": "#ffffff" };
	const marks = { "1": "+", "0": "×", "-": "–" };
	[...data.results].forEach((result, index) => {
		const x = 251 + index * 150;
		ctx.fillStyle = colors[result];
		ctx.fillRect(x, 770, 128, 128);
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#0e152a";
		ctx.strokeRect(x, 770, 128, 128);
		ctx.fillStyle = result === "-" ? "#0e152a" : "#ffffff";
		ctx.font = '700 60px "WatchVote Jost", sans-serif';
		ctx.fillText(marks[result], x + 64, 855);
	});
	text(`${summarize(data.results).correct}/4 correct`, 1080, 72);
	text(`Streak: ${data.streak} ${data.streak === 1 ? "day" : "days"}`, 1215, 54);
	text(data.rank, 1360, 65, "#855521", true);
	if (data.bench) text(`Bench question by ${data.bench}`, 1510, 42);
	text(data.shareUrl, 1815, 46, "#ffffff");
	const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
	if (!blob) throw new Error("Unable to make image");
	const href = URL.createObjectURL(blob);
	const download = el("a");
	download.href = href;
	download.download = `watchvote-trivia-${data.date}.png`;
	document.body.append(download);
	download.click();
	download.remove();
	setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

async function copyText(text, field, status, success) {
	field.hidden = false;
	field.value = text;
	try {
		await navigator.clipboard.writeText(text);
		status.textContent = success;
	} catch {
		field.focus();
		field.select();
		status.textContent = "Select and copy the text below.";
	}
}

export function sharePanel(data, complete) {
	const section = el("section", "wv-trivia__card v2-social");
	const title = el("h3", "", "Share your result");
	const squares = el("p", "v2-squares");
	squares.setAttribute("role", "img");
	squares.setAttribute("aria-label", `Question results: ${[...data.results].map((bit) => ({ "0": "incorrect", "1": "correct", "-": "unanswered" })[bit]).join(", ")}`);
	for (const bit of data.results) squares.append(el("span", `v2-square v2-square--${({ "0": "wrong", "1": "right", "-": "open" })[bit]}`));
	const actions = el("div", "wv-trivia__actions");
	const status = el("p", "wv-trivia__hint");
	status.setAttribute("role", "status");
	const field = el("textarea");
	field.hidden = true;
	field.readOnly = true;
	field.setAttribute("aria-label", "Shareable text or challenge link");
	const text = shareText(data);
	actions.append(button("Copy text", () => copyText(text, field, status, "Result copied.")),
		button("Download image", async () => {
			try {
				await downloadImage(data);
				status.textContent = "Story image downloaded.";
			} catch {
				status.textContent = "Couldn’t download the image. You can still copy the text.";
			}
		}));
	actions.prepend(button("Share your result", async () => {
		if (!navigator.share) return copyText(text, field, status, "Result copied.");
		try {
			await navigator.share({ text });
		} catch (error) {
			if (error.name !== "AbortError") await copyText(text, field, status, "Result copied.");
		}
	}));
	section.append(title, squares, actions);
	if (complete) {
		const label = el("label", "", "Name for the challenge link (optional)");
		label.htmlFor = "challenger-name";
		const name = el("input");
		name.id = "challenger-name";
		name.maxLength = 40;
		name.placeholder = "A collector";
		const challengeActions = el("div", "wv-trivia__actions");
		challengeActions.append(button("Challenge a friend", () => {
			const url = challengeUrl(location.href, { ...data, name: name.value });
			return copyText(url, field, status, "Challenge link copied.");
		}));
		section.append(label, name, challengeActions);
	}
	section.append(status, field);
	return section;
}
