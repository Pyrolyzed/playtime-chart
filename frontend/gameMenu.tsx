import { ConfirmModal, Menu, MenuItem, showContextMenu, showModal } from 'millennium';
import type { MouseEvent } from 'react';
import { Session, fmtDuration } from './data';
import { resetGames } from './tracker';

const MAX_LISTED_NAMES = 5;

interface GameMenuOptions {
	games: { appid: number; name: string }[];
	/** The games' finished sessions, across all dates. */
	sessions: Session[];
	/** Names of the games that are running, which can't be reset. */
	running: string[];
	onReset: (appids: number[]) => void;
	onError: (message: string) => void;
}

function listNames(names: string[]): string {
	if (names.length <= MAX_LISTED_NAMES) return names.join(', ');
	return `${names.slice(0, MAX_LISTED_NAMES).join(', ')} and ${names.length - MAX_LISTED_NAMES} more`;
}

function confirmReset(parent: Window, { games, sessions, onReset, onError }: GameMenuOptions) {
	const appids = games.map((g) => g.appid);
	const single = games.length === 1;
	const ms = sessions.reduce((n, s) => n + (s.end - s.start), 0);
	const count = `${sessions.length} recorded session${sessions.length === 1 ? '' : 's'}`;
	const reset = async () => {
		try {
			const result = await resetGames(appids);
			if (result.ok) onReset(appids);
			else onError(result.error ?? 'Could not reset the playtime data.');
		} catch (e) {
			onError(`Could not reset the playtime data: ${e}`);
		}
	};
	const what = single ? 'this game' : `${games.length} games: ${listNames(games.map((g) => g.name))}`;
	showModal(
		<ConfirmModal
			strTitle={single ? `Reset ${games[0].name}?` : `Reset ${games.length} games?`}
			strDescription={`This permanently removes all ${count} (${fmtDuration(ms)}) for ${what}, across every date range. Steam's own playtime isn't changed.`}
			strOKButtonText="Reset"
			bDestructiveWarning
			onOK={reset}
		/>,
		parent,
	);
}

/** Right-click menu for one or more games, opened from a card or chart entry. */
export function showGameMenu(e: MouseEvent<Element>, options: GameMenuOptions) {
	e.preventDefault();
	e.stopPropagation();
	// Steam's windows are separate from the plugin's, so the dialog needs the one clicked in
	const target = e.currentTarget;
	const parent = target.ownerDocument.defaultView ?? window;
	const { games, running } = options;
	const action = games.length === 1 ? 'Reset playtime data' : `Reset ${games.length} selected games`;
	const blocked = running.length > 0;
	showContextMenu(
		<Menu label={games.length === 1 ? games[0].name : `${games.length} games`}>
			<MenuItem tone="destructive" disabled={blocked} onClick={() => confirmReset(parent, options)}>
				{blocked ? `${action} (${listNames(running)} running)` : `${action}...`}
			</MenuItem>
		</Menu>,
		target,
	);
}
