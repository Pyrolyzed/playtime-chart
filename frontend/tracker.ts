import type { Session } from './data';

declare const backend: any;

const HEARTBEAT_MS = 30_000;

interface Live {
	appid: number;
	name: string;
	start: number;
	instances: Set<number>;
}

const live = new Map<number, Live>();
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function emit() {
	listeners.forEach((l) => {
		try {
			l();
		} catch (e) {
			console.error('listener failed', e);
		}
	});
}

/** Fires whenever a game starts or stops (so views can reload). */
export function subscribe(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** Currently running games, as open-ended sessions ending "now". */
export function liveSessions(now = Date.now()): Session[] {
	return [...live.values()].map((l) => ({
		id: `live-${l.appid}`,
		appid: l.appid,
		name: l.name,
		start: l.start,
		end: now,
		duration: Math.floor((now - l.start) / 1000),
		live: true,
	}));
}

export function appName(appid: number): string {
	try {
		const ov = (window as any).appStore?.GetAppOverviewByAppID?.(appid);
		if (ov?.display_name) return ov.display_name as string;
	} catch {
		/* fall through */
	}
	return `App ${appid}`;
}

function onLifetime(n: { unAppID: number; nInstanceID: number; bRunning: boolean }) {
	const appid = n.unAppID;
	if (n.bRunning) {
		let entry = live.get(appid);
		if (!entry) {
			entry = { appid, name: appName(appid), start: Date.now(), instances: new Set() };
			live.set(appid, entry);
			backend.ptSessionStart(appid, entry.name, entry.start).catch((e: unknown) => console.error('start failed', e));
		}
		entry.instances.add(n.nInstanceID);
		emit();
	} else {
		const entry = live.get(appid);
		if (!entry) return;
		entry.instances.delete(n.nInstanceID);
		if (entry.instances.size === 0) {
			live.delete(appid);
			backend
				.ptSessionEnd(appid, Date.now())
				.then(emit)
				.catch((e: unknown) => console.error('end failed', e));
		}
		emit();
	}
}

export function startTracking() {
	// plugin reloads must not leave a second listener behind
	(window as any).__playtimeChartStop?.();
	stop?.();

	const reg = (window as any).SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.(onLifetime);
	const timer = setInterval(() => {
		if (live.size) backend.ptHeartbeat(Date.now()).catch(() => {});
	}, HEARTBEAT_MS);

	if (!reg) console.error('SteamClient.GameSessions is unavailable; playtime will not be tracked');

	stop = () => {
		clearInterval(timer);
		reg?.unregister?.();
		stop = null;
	};
	(window as any).__playtimeChartStop = stop;
}

export async function loadSessions(): Promise<Session[]> {
	// Millennium already decodes JSON-looking strings returned by the backend,
	// so this is normally an array; fall back to parsing a raw string.
	const raw: unknown = await backend.ptGetSessions();
	let parsed: any[] = [];
	try {
		parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as any[]);
		if (!Array.isArray(parsed)) parsed = [];
	} catch (e) {
		console.error('Could not parse sessions', e);
	}
	return parsed
		.filter((s) => s && typeof s.start === 'number' && typeof s.end === 'number')
		.map((s) => ({ id: String(s.id), appid: s.appid, name: s.name, start: s.start, end: s.end, duration: s.duration }));
}

export async function deleteSession(id: string): Promise<boolean> {
	return backend.ptDeleteSession(id);
}
