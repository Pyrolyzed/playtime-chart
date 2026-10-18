import { useCallback, useEffect, useMemo, useState } from 'react';
import { GanttChart, PieChart, Capsule, StatsPanel, buildSlices } from './charts';
import {
	PRESETS,
	Preset,
	Range,
	Session,
	addDays,
	aggregateByGame,
	computeStats,
	fmtDate,
	fmtDuration,
	parseDateInput,
	rangeDays,
	resolveRange,
	startOfDay,
} from './data';
import { CSS } from './styles';
import { liveSessions, loadSessions, subscribe } from './tracker';

type Tab = 'library' | 'pie';
type Sort = 'played' | 'recent' | 'name';

const ALL = 'all';

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
	const [selected, setSelected] = useState<string>(ALL);
	const [search, setSearch] = useState('');
	const [sort, setSort] = useState<Sort>('played');
	const [tile, setTile] = useState(120);
	const [hideEmpty, setHideEmpty] = useState(true);

	const reload = useCallback(() => {
		loadSessions()
			.then((s) => setFinished(s))
			.catch((e) => console.error('Failed to load sessions', e))
			.finally(() => setLoaded(true));
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

	const selectedGame = selected === ALL ? null : games.find((g) => String(g.appid) === selected) ?? null;
	// a game with no playtime in this range disappears from the grid; fall back to "All"
	const effectiveSelected = selected === ALL || selectedGame ? selected : ALL;

	const detailSessions = useMemo(
		() => (effectiveSelected === ALL ? sessions : sessions.filter((s) => String(s.appid) === effectiveSelected)),
		[sessions, effectiveSelected],
	);
	const stats = useMemo(() => computeStats(detailSessions, range), [detailSessions, range]);
	const allStats = useMemo(() => computeStats(sessions, range), [sessions, range]);
	const slices = useMemo(() => buildSlices(games), [games]);
	const runningIds = new Set(liveSessions().map((s) => s.appid));

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
							<div className={`ptc-card${effectiveSelected === ALL ? ' sel' : ''}`} onClick={() => setSelected(ALL)}>
								<div className="ptc-cover">
									<div className="ptc-all-cover">All games</div>
									<div className="ptc-badge">{fmtDuration(allStats.totalMs)}</div>
								</div>
								<div className="ptc-card-name">{games.length} game{games.length === 1 ? '' : 's'}</div>
							</div>
							{visibleGames.map((g) => (
								<div
									key={g.appid}
									className={`ptc-card${effectiveSelected === String(g.appid) ? ' sel' : ''}`}
									onClick={() => setSelected(String(g.appid))}
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
							<h2>{selectedGame ? selectedGame.name : 'All games'}</h2>
							<div className="ptc-sub">{rangeLabel}</div>
						</div>
						<StatsPanel stats={stats} />
						<div>
							<div className="ptc-section-head">
								<span>Session timeline</span>
								<label>
									<input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
									Hide days without playtime
								</label>
							</div>
							<GanttChart sessions={detailSessions} range={range} multi={effectiveSelected === ALL} hideEmpty={hideEmpty} />
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
					<PieChart slices={slices} />
				</div>
			)}
		</div>
	);
}
