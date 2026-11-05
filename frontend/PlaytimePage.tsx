import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { GameBreakdown, GanttChart, PieChart, Capsule, SelectionLegend, StatsPanel, buildSlices } from './charts';
import {
	PRESETS,
	Preset,
	Range,
	Selection,
	Session,
	addDays,
	aggregateByGame,
	assignColors,
	colorFor,
	computeStats,
	fmtDate,
	fmtDuration,
	nextSelection,
	parseDateInput,
	rangeDays,
	resolveRange,
	startOfDay,
} from './data';
import { showGameMenu } from './gameMenu';
import { CSS } from './styles';
import { StorageInfo, getStorageInfo, liveSessions, loadSessions, subscribe } from './tracker';

type Tab = 'library' | 'pie';
type Sort = 'played' | 'recent' | 'name';

function toInput(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PlaytimePage() {
	const [finished, setFinished] = useState<Session[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [tick, setTick] = useState(0); // re-evaluates live sessions
	const [tab, setTab] = useState<Tab>('library');
	const [preset, setPreset] = useState<Preset>('30d');
	const [customFrom, setCustomFrom] = useState(toInput(addDays(startOfDay(Date.now()), -29)));
	const [customTo, setCustomTo] = useState(toInput(Date.now()));
	const [selection, setSelection] = useState<Selection>({ selected: [], anchor: null });
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<Sort>('played');
	const [tile, setTile] = useState(120);
	const [hideEmpty, setHideEmpty] = useState(true);
	const [storage, setStorage] = useState<StorageInfo | null>(null);
	const [resetError, setResetError] = useState('');

	const reload = useCallback(() => {
		loadSessions()
			.then((s) => setFinished(s))
			.catch((e) => console.error('Failed to load sessions', e))
			.finally(() => setLoaded(true));
		getStorageInfo()
			.then(setStorage)
			.catch((e) => console.error('Failed to read storage info', e));
	}, []);

	useEffect(() => {
		reload();
		const unsub = subscribe(() => {
			setTick((t) => t + 1);
			reload();
		});
		const timer = setInterval(() => setTick((t) => t + 1), 30_000);
		return () => {
			unsub();
			clearInterval(timer);
		};
	}, [reload]);

	// finished + currently running
	const sessions = useMemo(() => [...finished, ...liveSessions()], [finished, tick]);

	const customRange: Range = useMemo(() => {
		const f = parseDateInput(customFrom);
		const t = parseDateInput(customTo);
		if (f === null || t === null || t < f) return { from: addDays(startOfDay(Date.now()), -29), to: addDays(startOfDay(Date.now()), 1) };
		return { from: f, to: addDays(t, 1) };
	}, [customFrom, customTo]);

	const range = useMemo(() => resolveRange(preset, sessions, customRange), [preset, sessions, customRange]);

	const choosePreset = (p: Preset) => {
		if (p === 'custom') {
			setCustomFrom(toInput(range.from));
			setCustomTo(toInput(range.to - 1));
		}
		setPreset(p);
	};

	const games = useMemo(() => aggregateByGame(sessions, range), [sessions, range]);

	const visibleGames = useMemo(() => {
		const q = search.trim().toLowerCase();
		const list = games.filter((g) => !q || g.name.toLowerCase().includes(q));
		list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? b.lastPlayed - a.lastPlayed : b.ms - a.ms));
		return list;
	}, [games, search, sort]);

	// a game with no playtime in this range disappears from the grid; none left means "All games"
	const selectedGames = useMemo(
		() => selection.selected.flatMap((id) => games.filter((g) => g.appid === id)),
		[selection.selected, games],
	);
	const selectedIds = useMemo(() => new Set(selectedGames.map((g) => g.appid)), [selectedGames]);
	const isAll = selectedGames.length === 0;

	const clickGame = (e: MouseEvent, appid: number) => {
		const order = visibleGames.map((g) => g.appid);
		setSelection(nextSelection(selection, appid, order, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }));
	};

	const detailSessions = useMemo(() => (isAll ? sessions : sessions.filter((s) => selectedIds.has(s.appid))), [sessions, isAll, selectedIds]);
	const stats = useMemo(() => computeStats(detailSessions, range), [detailSessions, range]);
	const breakdown = useMemo<GameBreakdown[] | undefined>(() => {
		if (selectedGames.length < 2) return undefined;
		const colors = assignColors(selectedGames.map((g) => g.appid));
		return selectedGames.map((g) => ({
			appid: g.appid,
			name: g.name,
			color: colors.get(g.appid) as string,
			stats: computeStats(detailSessions.filter((s) => s.appid === g.appid), range),
		}));
	}, [selectedGames, detailSessions, range]);
	const colorOf = useMemo(() => {
		if (isAll) return colorFor;
		if (!breakdown) return undefined;
		const colors = new Map(breakdown.map((g) => [g.appid, g.color]));
		return (appid: number) => colors.get(appid) ?? colorFor(appid);
	}, [isAll, breakdown]);
	const allStats = useMemo(() => computeStats(sessions, range), [sessions, range]);
	const slices = useMemo(() => buildSlices(games), [games]);
	const runningIds = new Set(liveSessions().map((s) => s.appid));

	const openGameMenu = (e: MouseEvent<Element>, menuGames: { appid: number; name: string }[]) => {
		setResetError('');
		const ids = new Set(menuGames.map((g) => g.appid));
		showGameMenu(e, {
			games: menuGames,
			sessions: finished.filter((s) => ids.has(s.appid)),
			running: menuGames.filter((g) => runningIds.has(g.appid)).map((g) => g.name),
			onReset: (reset) => setSelection((cur) => ({ ...cur, selected: cur.selected.filter((id) => !reset.includes(id)) })),
			onError: setResetError,
		});
	};

	const rangeLabel = `${fmtDate(range.from)} – ${fmtDate(range.to - 1)} (${rangeDays(range)} day${rangeDays(range) === 1 ? '' : 's'})`;

	return (
		<div className="ptc-root">
			<style>{CSS}</style>

			<div className="ptc-top">
				<div className="ptc-title">Playtime Chart</div>
				<div className="ptc-tabs">
					<button className={`ptc-btn${tab === 'library' ? ' on' : ''}`} onClick={() => setTab('library')}>
						Library
					</button>
					<button className={`ptc-btn${tab === 'pie' ? ' on' : ''}`} onClick={() => setTab('pie')}>
						Distribution
					</button>
				</div>
				<div className="ptc-presets">
					{PRESETS.map((p) => (
						<button key={p.id} className={`ptc-btn${preset === p.id ? ' on' : ''}`} onClick={() => choosePreset(p.id)}>
							{p.label}
						</button>
					))}
				</div>
				{preset === 'custom' && (
					<>
						<input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
						<span>→</span>
						<input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} />
					</>
				)}
				<div className="ptc-spacer" />
				<div className="ptc-sub">{rangeLabel}</div>
				<button className="ptc-btn" onClick={reload}>
					Refresh
				</button>
			</div>

			{storage && !storage.available && (
				<div className="ptc-warn">
					Can't reach the data folder {storage.dir}, so older sessions may be missing. New sessions are kept on this PC and moved there once it is back.
				</div>
			)}

			{resetError && <div className="ptc-warn">{resetError}</div>}

			{tab === 'library' ? (
				<div className="ptc-body">
					<div className="ptc-library">
						<div className="ptc-tools">
							<input type="text" placeholder="Search games" value={search} onChange={(e) => setSearch(e.target.value)} />
							<select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
								<option value="played">Most played</option>
								<option value="recent">Recently played</option>
								<option value="name">Name</option>
							</select>
							<input type="range" min={90} max={220} value={tile} onChange={(e) => setTile(Number(e.target.value))} title="Icon size" />
						</div>
						<div className="ptc-grid ptc-scroll" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))` }}>
							<div className={`ptc-card${isAll ? ' sel' : ''}`} onClick={() => setSelection({ selected: [], anchor: null })}>
								<div className="ptc-cover">
									<div className="ptc-all-cover">All games</div>
									<div className="ptc-badge">{fmtDuration(allStats.totalMs)}</div>
								</div>
								<div className="ptc-card-name">{games.length} game{games.length === 1 ? '' : 's'}</div>
							</div>
							{visibleGames.map((g) => (
								<div
									key={g.appid}
									className={`ptc-card${selectedIds.has(g.appid) ? ' sel' : ''}`}
									onClick={(e) => clickGame(e, g.appid)}
									onContextMenu={(e) => openGameMenu(e, selectedGames.length > 1 && selectedIds.has(g.appid) ? selectedGames : [g])}
									title={g.name}
								>
									<div className="ptc-cover">
										<Capsule appid={g.appid} name={g.name} />
										{runningIds.has(g.appid) && <div className="ptc-live-dot">PLAYING</div>}
										<div className="ptc-badge">{fmtDuration(g.ms)}</div>
									</div>
									<div className="ptc-card-name">{g.name}</div>
								</div>
							))}
							{loaded && !games.length && <div className="ptc-empty" style={{ gridColumn: '1 / -1' }}>No playtime recorded in this range yet. Sessions are recorded while this plugin is enabled.</div>}
						</div>
					</div>

					<div className="ptc-detail ptc-scroll">
						<div>
							<h2>{isAll ? 'All games' : breakdown ? `${breakdown.length} games selected` : selectedGames[0].name}</h2>
							<div className="ptc-sub">{rangeLabel}</div>
						</div>
						{breakdown && <SelectionLegend breakdown={breakdown} />}
						<StatsPanel stats={stats} breakdown={breakdown} />
						<div>
							<div className="ptc-section-head">
								<span>Session timeline</span>
								<label>
									<input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
									Hide days without playtime
								</label>
							</div>
							<GanttChart sessions={detailSessions} range={range} colorOf={colorOf} hideEmpty={hideEmpty} />
						</div>
					</div>
				</div>
			) : (
				<div className="ptc-pie-page ptc-scroll">
					<div>
						<h2 style={{ margin: 0 }}>Where did the time go?</h2>
						<div className="ptc-sub">
							{rangeLabel} · {games.length} game{games.length === 1 ? '' : 's'} · {allStats.sessions} session{allStats.sessions === 1 ? '' : 's'}
						</div>
					</div>
					<PieChart slices={slices} onGameMenu={(e, appid, name) => openGameMenu(e, [{ appid, name }])} />
				</div>
			)}
		</div>
	);
}
