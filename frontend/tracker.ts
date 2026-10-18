import { Router } from 'millennium';
import type { Session } from './data';

declare const backend: any;

const HEARTBEAT_MS = 30_000;

interface Live {
	appid: number;
	name: string;
	start: number;
	instances: Set<number>;
	/** first time reconcile() saw Steam not listing this app as running */
	missingSince?: number;
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

function endSession(appid: number, endMs: number) {
	if (!live.delete(appid)) return;
	backend
		.ptSessionEnd(appid, endMs)
		.then(emit)
		.catch((e: unknown) => console.error('end failed', e));
	emit();
}

function onLifetime(n: { unAppID: number; nInstanceID: number; bRunning: boolean }) {
	const appid = n.unAppID;
	console.log(`lifetime event: app ${appid} instance ${n.nInstanceID} running=${n.bRunning}`);
	if (n.bRunning) {
		let entry = live.get(appid);
		if (!entry) {
			entry = { appid, name: appName(appid), start: Date.now(), instances: new Set() };
			live.set(appid, entry);
			backend.ptSessionStart(appid, entry.name, entry.start).catch((e: unknown) => console.error('start failed', e));
		}
		entry.instances.add(n.nInstanceID);
		entry.missingSince = undefined;
		emit();
	} else {
		const entry = live.get(appid);
		if (!entry) return;
		entry.instances.delete(n.nInstanceID);
		if (entry.instances.size === 0) endSession(appid, Date.now());
		else emit();
	}
}

/** appids Steam currently considers running, or null if it can't be read. */
function runningAppIds(): Set<number> | null {
	try {
		const apps = Router?.RunningApps;
		if (!Array.isArray(apps)) return null;
		return new Set(apps.map((a: any) => a?.appid).filter((id: unknown) => typeof id === 'number'));
	} catch {
		return null;
	}
}

const RECONCILE_MS = 5_000;
const STARTUP_GRACE_MS = 20_000;
const MISSING_CONFIRM_MS = 10_000;

/**
 * Launcher-based games (e.g. The Witcher 3's REDlauncher) can report several instances and drop
 * a "stopped" event. If Steam itself no longer lists the app as running, close the session at the
 * moment it first disappeared.
 */
function reconcile() {
	const running = runningAppIds();
	if (!running) return;
	const now = Date.now();
	for (const entry of [...live.values()]) {
		if (running.has(entry.appid)) {
			entry.missingSince = undefined;
			continue;
		}
		if (now - entry.start < STARTUP_GRACE_MS) continue;
		entry.missingSince ??= now;
		if (now - entry.missingSince >= MISSING_CONFIRM_MS) {
			console.log(`app ${entry.appid} is no longer running per Steam; closing session`);
			endSession(entry.appid, entry.missingSince);
		}
	}
}

export function startTracking() {
	// plugin reloads must not leave a second listener behind
	(window as any).__playtimeChartStop?.();
	stop?.();

	const reg = (window as any).SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.(onLifetime);
	const beat = setInterval(() => {
		if (live.size) backend.ptHeartbeat(Date.now()).catch(() => {});
	}, HEARTBEAT_MS);
	const recon = setInterval(reconcile, RECONCILE_MS);

	if (!reg) console.error('SteamClient.GameSessions is unavailable; playtime will not be tracked');

	stop = () => {
		clearInterval(beat);
		clearInterval(recon);
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
