// Pure data helpers: types, date ranges, aggregation, statistics.
// All calendar maths use the local time zone.

export interface Session {
	id: string;
	appid: number;
	name: string;
	/** unix ms */
	start: number;
	/** unix ms */
	end: number;
	/** seconds */
	duration: number;
	/** true while the game is still running */
	live?: boolean;
}

export interface Range {
	from: number; // inclusive, unix ms
	to: number; // exclusive, unix ms
}

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export function startOfDay(ms: number): number {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** DST-safe day arithmetic. */
export function addDays(ms: number, n: number): number {
	const d = new Date(ms);
	d.setDate(d.getDate() + n);
	return d.getTime();
}

export function dayKey(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** yyyy-mm-dd (as used by <input type="date">) -> local midnight */
export function parseDateInput(value: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return isNaN(d.getTime()) ? null : d.getTime();
}

// ---------- formatting ----------

export function fmtDuration(ms: number): string {
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	const rm = m % 60;
	if (h < 100) return rm ? `${h}h ${rm}m` : `${h}h`;
	return `${h}h`;
}

export function fmtDate(ms: number): string {
	return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtTime(ms: number): string {
	return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(ms: number): string {
	return `${fmtDate(ms)} ${fmtTime(ms)}`;
}

// ---------- ranges ----------

export type Preset = 'today' | '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';

export const PRESETS: { id: Preset; label: string }[] = [
	{ id: 'today', label: 'Today' },
	{ id: '7d', label: '7 days' },
	{ id: '30d', label: '30 days' },
	{ id: '90d', label: '90 days' },
	{ id: 'year', label: '1 year' },
	{ id: 'all', label: 'All time' },
	{ id: 'custom', label: 'Custom' },
];

/** `custom` is the already-resolved custom range; ignored for other presets. */
export function resolveRange(preset: Preset, sessions: Session[], custom: Range, now = Date.now()): Range {
	const today = startOfDay(now);
	const to = addDays(today, 1);
	switch (preset) {
		case 'today':
			return { from: today, to };
		case '7d':
			return { from: addDays(today, -6), to };
		case '30d':
			return { from: addDays(today, -29), to };
		case '90d':
			return { from: addDays(today, -89), to };
		case 'year':
			return { from: addDays(today, -364), to };
		case 'all': {
			let min = today;
			for (const s of sessions) if (s.start < min) min = s.start;
			return { from: startOfDay(min), to };
		}
		case 'custom':
			return custom;
	}
}

export function rangeDays(r: Range): number {
	return Math.max(1, Math.round((r.to - r.from) / DAY));
}

/** Portion of the session inside the range, or null if it doesn't overlap. */
export function clip(s: Session, r: Range): [number, number] | null {
	const a = Math.max(s.start, r.from);
	const b = Math.min(s.end, r.to);
	return b > a ? [a, b] : null;
}

// ---------- aggregation ----------

export interface GameAgg {
	appid: number;
	name: string;
	ms: number;
	sessions: number;
	lastPlayed: number;
}

export function aggregateByGame(sessions: Session[], range: Range): GameAgg[] {
	const map = new Map<number, GameAgg>();
	for (const s of sessions) {
		const c = clip(s, range);
		if (!c) continue;
		let g = map.get(s.appid);
		if (!g) {
			g = { appid: s.appid, name: s.name, ms: 0, sessions: 0, lastPlayed: 0 };
			map.set(s.appid, g);
		}
		g.ms += c[1] - c[0];
		g.sessions += 1;
		if (s.end > g.lastPlayed) {
			g.lastPlayed = s.end;
			g.name = s.name; // newest name wins
		}
	}
	return [...map.values()];
}

export interface Segment {
	session: Session;
	/** ms from local midnight of the day */
	from: number;
	to: number;
}

/** Splits sessions at local midnights. Keys are the day's local midnight. */
export function splitByDay(sessions: Session[], range: Range): Map<number, Segment[]> {
	const days = new Map<number, Segment[]>();
	for (const s of sessions) {
		const c = clip(s, range);
		if (!c) continue;
		let day = startOfDay(c[0]);
		while (day < c[1]) {
			const next = addDays(day, 1);
			const a = Math.max(c[0], day);
			const b = Math.min(c[1], next);
			if (b > a) {
				let list = days.get(day);
				if (!list) days.set(day, (list = []));
				list.push({ session: s, from: a - day, to: b - day });
			}
			day = next;
		}
	}
	return days;
}

// ---------- statistics ----------

export interface Stats {
	totalMs: number;
	sessions: number;
	avgMs: number;
	medianMs: number;
	longest: Session | null;
	longestMs: number;
	firstPlayed: number | null;
	lastPlayed: number | null;
	activeDays: number;
	calendarDays: number;
	avgPerActiveDayMs: number;
	avgPerCalendarDayMs: number;
	longestStreak: number;
	currentStreak: number;
	/** ms per weekday, index 0 = Sunday */
	byWeekday: number[];
	/** ms per hour of day */
	byHour: number[];
	busiestDay: { day: number; ms: number } | null;
}

export function computeStats(sessions: Session[], range: Range, now = Date.now()): Stats {
	const lens: number[] = [];
	let total = 0;
	let longest: Session | null = null;
	let longestMs = 0;
	let first: number | null = null;
	let last: number | null = null;
	const byWeekday = new Array(7).fill(0);
	const byHour = new Array(24).fill(0);

	for (const s of sessions) {
		const c = clip(s, range);
		if (!c) continue;
		const len = c[1] - c[0];
		lens.push(len);
		total += len;
		if (len > longestMs) {
			longestMs = len;
			longest = s;
		}
		if (first === null || c[0] < first) first = c[0];
		if (last === null || c[1] > last) last = c[1];

		// weekday + hour-of-day buckets, walking hour boundaries
		let t = c[0];
		while (t < c[1]) {
			const d = new Date(t);
			const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
			const end = Math.min(c[1], nextHour);
			byWeekday[d.getDay()] += end - t;
			byHour[d.getHours()] += end - t;
			t = end;
		}
	}

	const perDay = new Map<number, number>();
	for (const [day, segs] of splitByDay(sessions, range)) {
		perDay.set(day, segs.reduce((n, g) => n + (g.to - g.from), 0));
	}
	let busiest: Stats['busiestDay'] = null;
	for (const [day, ms] of perDay) if (!busiest || ms > busiest.ms) busiest = { day, ms };

	const dayList = [...perDay.keys()].sort((a, b) => a - b);
	let longestStreak = 0;
	let run = 0;
	let prev: number | null = null;
	for (const day of dayList) {
		run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
		if (run > longestStreak) longestStreak = run;
		prev = day;
	}
	// current streak: consecutive days ending today (or yesterday, if not played yet today)
	let currentStreak = 0;
	let cursor = startOfDay(now);
	if (!perDay.has(cursor)) cursor = addDays(cursor, -1);
	while (perDay.has(cursor)) {
		currentStreak++;
		cursor = addDays(cursor, -1);
	}

	const sorted = [...lens].sort((a, b) => a - b);
	const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
	// "calendar days" stops at today so a future-dated range doesn't dilute the average
	const calendarDays = Math.max(1, rangeDays({ from: range.from, to: Math.min(range.to, addDays(startOfDay(now), 1)) }));

	return {
		totalMs: total,
		sessions: lens.length,
		avgMs: lens.length ? total / lens.length : 0,
		medianMs: median,
		longest,
		longestMs,
		firstPlayed: first,
		lastPlayed: last,
		activeDays: perDay.size,
		calendarDays,
		avgPerActiveDayMs: perDay.size ? total / perDay.size : 0,
		avgPerCalendarDayMs: total / calendarDays,
		longestStreak,
		currentStreak,
		byWeekday,
		byHour,
		busiestDay: busiest,
	};
}

// ---------- colours ----------

export const PALETTE = [
	'#4c9be8',
	'#e8793a',
	'#59b86b',
	'#c46bd6',
	'#e8c43a',
	'#3ac4c4',
	'#e8586f',
	'#8c8cf0',
	'#9bbf3a',
	'#e89ab0',
	'#b08a5a',
	'#6fa0a0',
];
export const OTHER_COLOR = '#6b7785';

/** Stable colour per game, independent of the current ranking. */
export function colorFor(appid: number): string {
	return PALETTE[Math.abs(Math.imul(appid, 2654435761) >>> 0) % PALETTE.length];
}
