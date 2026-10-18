const CDN = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps';

function safe<T>(fn: () => T): T | undefined {
	try {
		return fn();
	} catch {
		return undefined;
	}
}

/**
 * Portrait capsule candidates, best first. Anything the user (or an artwork plugin such as a
 * SteamGridDB one) set through Steam's custom-artwork system wins, then what Steam's own library
 * would show, then the public CDN.
 */
export function capsuleUrls(appid: number): string[] {
	const store = (window as any).appStore;
	const overview = safe(() => store?.GetAppOverviewByAppID?.(appid));
	const urls: string[] = [];
	const add = (u: unknown) => {
		if (typeof u === 'string' && u && !urls.includes(u)) urls.push(u);
	};

	if (overview) {
		const custom = safe(() => store.GetCustomVerticalCapsuleURLs?.(overview));
		if (Array.isArray(custom)) custom.forEach(add);
		add(safe(() => store.GetVerticalCapsuleURLForApp?.(overview)));
		add(safe(() => store.GetCachedVerticalImageURLForApp?.(overview)));
		add(safe(() => store.GetPregeneratedVerticalCapsuleForApp?.(overview)));
	}

	add(`${CDN}/${appid}/library_600x900.jpg`);
	add(`${CDN}/${appid}/header.jpg`);
	return urls;
}
