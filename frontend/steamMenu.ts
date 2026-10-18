import { findInReactTree, getReactRoot } from 'millennium';

const ITEM_NAME = 'Playtime Chart';
const patched = new WeakSet<object>();
const patches: { unpatch?: () => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

function candidateDocuments(): Document[] {
	const docs: Document[] = [document];
	try {
		for (const w of (window as any).SteamUIStore?.WindowStore?.SteamUIWindows ?? []) {
			const d = w?.BrowserWindow?.document;
			if (d && !docs.includes(d)) docs.push(d);
		}
	} catch {
		/* ignore */
	}
	return docs;
}

/** Adds `onClick` as an entry in the client's "Steam" menu (View / Friends / Games row). */
function tryPatch(onClick: () => void): boolean {
	let found = false;
	for (const doc of candidateDocuments()) {
		const rootEl = doc.getElementById('root');
		if (!rootEl) continue;
		let steamMenu: any;
		try {
			steamMenu = findInReactTree(getReactRoot(rootEl as any), (m: any) => m?.pendingProps?.title === 'Steam' && m?.pendingProps?.menuContent);
		} catch {
			continue;
		}
		const content = steamMenu?.pendingProps?.menuContent;
		if (!content) continue;
		found = true;
		if (patched.has(content)) continue;
		patched.add(content);

		patches.push(wrapInnermost(content, onClick));
	}
	return found;
}

/**
 * Other patches (Millennium's own Steam-menu entry) are chained through `.original`
 * and hand back already-rendered output. Wrapping the innermost original puts our item
 * into `menuItems` before any of them run, and lets us return the element untouched.
 */
function wrapInnermost(content: any, onClick: () => void): { unpatch: () => void } {
	let holder: any = content;
	let prop = 'type';
	while (holder[prop]?.__millenniumPatch) {
		holder = holder[prop].__millenniumPatch;
		prop = 'original';
	}
	const orig = holder[prop];
	const wrapped = function (this: any, ...args: any[]) {
		const ret = orig.apply(this, args);
		const items: any[] | undefined = ret?.props?.menuItems;
		if (Array.isArray(items) && !items.some((i) => i?.name === ITEM_NAME)) {
			// before the trailing "Exit" entry
			items.splice(Math.max(items.length - 1, 0), 0, { name: ITEM_NAME, onClick, visible: true }, 'separator');
		}
		return ret;
	};
	Object.assign(wrapped, orig);
	wrapped.toString = () => orig.toString();
	holder[prop] = wrapped;
	return {
		unpatch() {
			if (holder[prop] === wrapped) holder[prop] = orig;
		},
	};
}

export function installSteamMenuItem(onClick: () => void) {
	stopped = false;
	const loop = () => {
		if (stopped) return;
		let found = false;
		try {
			found = tryPatch(onClick);
		} catch (e) {
			console.error('Steam menu patch failed', e);
		}
		// poll fast until the menu exists, then occasionally in case the window is recreated
		timer = setTimeout(loop, found ? 10_000 : 1_000);
	};
	loop();
}

export function removeSteamMenuItem() {
	stopped = true;
	if (timer) clearTimeout(timer);
	patches.forEach((p) => p?.unpatch?.());
	patches.length = 0;
}
