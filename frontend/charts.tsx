import { useMemo, useState } from 'react';
import { capsuleUrls } from './artwork';
import {
	DAY,
	GameAgg,
	OTHER_COLOR,
	PALETTE,
	Range,
	Segment,
	Session,
	Stats,
	addDays,
	colorFor,
	fmtDate,
	fmtDateTime,
	fmtDuration,
	fmtTime,
	splitByDay,
	startOfDay,
} from './data';

// ---------- game capsule ----------

export function Capsule({ appid, name }: { appid: number; name: string }) {
	// resolved once per mount so a failing url advances through the list instead of restarting it
	const urls = useMemo(() => capsuleUrls(appid), [appid]);
	const [i, setI] = useState(0);
	if (i >= urls.length) {
		return (
			<div className="ptc-capsule-fallback" style={{ background: colorFor(appid) }}>
				{name.slice(0, 2).toUpperCase()}
			</div>
		);
	}
	return <img className="ptc-capsule-img" src={urls[i]} alt="" draggable={false} onError={() => setI(i + 1)} />;
}

// ---------- statistics ----------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
	return (
		<div className="ptc-tile">
			<div className="ptc-tile-label">{label}</div>
			<div className="ptc-tile-value">{value}</div>
			{sub && <div className="ptc-tile-sub">{sub}</div>}
		</div>
	);
}

function MiniBars({ values, labels, title }: { values: number[]; labels: string[]; title: string }) {
	const max = Math.max(1, ...values);
	return (
		<div className="ptc-minibars">
			<div className="ptc-tile-label">{title}</div>
			<div className="ptc-minibars-row">
				{values.map((v, i) => (
					<div key={i} className="ptc-minibar-col" title={`${labels[i]}: ${fmtDuration(v)}`}>
						<div className="ptc-minibar-track">
							<div className="ptc-minibar-fill" style={{ height: `${(v / max) * 100}%` }} />
						</div>
						<div className="ptc-minibar-label">{labels[i]}</div>
					</div>
				))}
			</div>
		</div>
	);
}

export function StatsPanel({ stats }: { stats: Stats }) {
	const hourLabels = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? String(h) : ''));
	return (
		<div className="ptc-stats">
			<div className="ptc-tiles">
				<Tile label="Total playtime" value={fmtDuration(stats.totalMs)} sub={`${stats.sessions} session${stats.sessions === 1 ? '' : 's'}`} />
				<Tile label="Average session" value={fmtDuration(stats.avgMs)} sub={`median ${fmtDuration(stats.medianMs)}`} />
				<Tile
					label="Longest session"
					value={fmtDuration(stats.longestMs)}
					sub={stats.longest ? fmtDate(stats.longest.start) : '—'}
				/>
				<Tile
					label="Days played"
					value={`${stats.activeDays} / ${stats.calendarDays}`}
					sub={`${fmtDuration(stats.avgPerActiveDayMs)} per active day`}
				/>
				<Tile label="Daily average" value={fmtDuration(stats.avgPerCalendarDayMs)} sub="over the whole range" />
				<Tile
					label="Streaks"
					value={`${stats.longestStreak}d longest`}
					sub={stats.currentStreak ? `${stats.currentStreak}d current` : 'no current streak'}
				/>
				<Tile
					label="Busiest day"
					value={stats.busiestDay ? fmtDuration(stats.busiestDay.ms) : '—'}
					sub={stats.busiestDay ? fmtDate(stats.busiestDay.day) : undefined}
				/>
				<Tile
					label="First / last played"
					value={stats.firstPlayed ? fmtDate(stats.firstPlayed) : '—'}
					sub={stats.lastPlayed ? `last ${fmtDateTime(stats.lastPlayed)}` : undefined}
				/>
			</div>
			<div className="ptc-minibars-wrap">
				<MiniBars title="By weekday" values={stats.byWeekday} labels={WEEKDAYS} />
				<MiniBars title="By hour of day" values={stats.byHour} labels={hourLabels} />
			</div>
		</div>
	);
}

// ---------- Gantt ----------

interface GanttProps {
	sessions: Session[];
	range: Range;
	/** colour every game differently (all-games view) */
	multi: boolean;
	hideEmpty: boolean;
}

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function GanttChart({ sessions, range, multi, hideEmpty }: GanttProps) {
	const [hover, setHover] = useState<Session | null>(null);

	const rows = useMemo(() => {
		const byDay = splitByDay(sessions, range);
		const out: { day: number; segs: Segment[] }[] = [];
		const today = startOfDay(Date.now());
		const last = Math.min(startOfDay(range.to - 1), today);
		for (let day = last; day >= range.from; day = addDays(day, -1)) {
			const segs = byDay.get(day);
			if (!segs && hideEmpty) continue;
			out.push({ day, segs: segs ?? [] });
		}
		return out;
	}, [sessions, range, hideEmpty]);

	if (!rows.length) return <div className="ptc-empty">No sessions in this date range.</div>;

	return (
		<div className="ptc-gantt">
			<div className="ptc-gantt-head">
				<div className="ptc-gantt-label" />
				<div className="ptc-gantt-axis">
					{HOUR_MARKS.map((h) => (
						<span key={h} style={{ left: `${(h / 24) * 100}%` }}>
							{String(h).padStart(2, '0')}
						</span>
					))}
				</div>
				<div className="ptc-gantt-total" />
			</div>
			<div className="ptc-gantt-body">
				{rows.map(({ day, segs }) => {
					const total = segs.reduce((n, g) => n + (g.to - g.from), 0);
					return (
						<div className="ptc-gantt-row" key={day}>
							<div className="ptc-gantt-label">
								{new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
							</div>
							<div className="ptc-gantt-track">
								{segs.map((g, i) => (
									<div
										key={`${g.session.id}-${i}`}
										className={`ptc-bar${g.session.live ? ' live' : ''}`}
										style={{
											left: `${(g.from / DAY) * 100}%`,
											width: `${Math.max(((g.to - g.from) / DAY) * 100, 0.25)}%`,
											background: multi ? colorFor(g.session.appid) : undefined,
										}}
										onMouseEnter={() => setHover(g.session)}
										onMouseLeave={() => setHover(null)}
										title={`${g.session.name}\n${fmtDateTime(g.session.start)} → ${g.session.live ? 'now' : fmtTime(g.session.end)}\n${fmtDuration(g.session.end - g.session.start)}`}
									/>
								))}
							</div>
							<div className="ptc-gantt-total">{total ? fmtDuration(total) : ''}</div>
						</div>
					);
				})}
			</div>
			<div className="ptc-gantt-hover">
				{hover ? (
					<>
						<b>{hover.name}</b> · started {fmtDateTime(hover.start)} · {hover.live ? 'still running' : `ended ${fmtDateTime(hover.end)}`} · lasted{' '}
						{fmtDuration(hover.end - hover.start)}
					</>
				) : (
					'Hover a bar for session details.'
				)}
			</div>
		</div>
	);
}

// ---------- pie ----------

export interface Slice {
	key: string;
	label: string;
	ms: number;
	color: string;
}

/** Top games by rank colour; everything past `max` collapses to "Other". */
export function buildSlices(games: GameAgg[], max = 11): Slice[] {
	const sorted = [...games].sort((a, b) => b.ms - a.ms);
	const head = sorted.slice(0, max);
	const slices: Slice[] = head.map((g, i) => ({ key: String(g.appid), label: g.name, ms: g.ms, color: PALETTE[i % PALETTE.length] }));
	const rest = sorted.slice(max);
	if (rest.length) {
		slices.push({ key: 'other', label: `Other (${rest.length} games)`, ms: rest.reduce((n, g) => n + g.ms, 0), color: OTHER_COLOR });
	}
	return slices;
}

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
	const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
	const large = a1 - a0 > Math.PI ? 1 : 0;
	return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

export function PieChart({ slices }: { slices: Slice[] }) {
	const [active, setActive] = useState<string | null>(null);
	const total = slices.reduce((n, s) => n + s.ms, 0);
	if (!total) return <div className="ptc-empty">No playtime in this date range.</div>;

	const size = 320;
	const c = size / 2;
	const shown = slices.find((s) => s.key === active);
	let angle = -Math.PI / 2;

	return (
		<div className="ptc-pie">
			<svg viewBox={`0 0 ${size} ${size}`} className="ptc-pie-svg">
				{slices.length === 1 ? (
					<circle
						cx={c}
						cy={c}
						r={(c - 6 + 70) / 2}
						fill="none"
						stroke={slices[0].color}
						strokeWidth={c - 6 - 70}
						onMouseEnter={() => setActive(slices[0].key)}
						onMouseLeave={() => setActive(null)}
					/>
				) : (
					slices.map((s) => {
						const sweep = (s.ms / total) * Math.PI * 2;
						const a0 = angle;
						angle += sweep;
						const isActive = active === s.key;
						return (
							<path
								key={s.key}
								d={arcPath(c, c, 70, isActive ? c - 2 : c - 8, a0, angle - 0.0001)}
								fill={s.color}
								stroke="var(--ptc-bg)"
								strokeWidth={1.5}
								onMouseEnter={() => setActive(s.key)}
								onMouseLeave={() => setActive(null)}
							>
								<title>{`${s.label}: ${fmtDuration(s.ms)} (${((s.ms / total) * 100).toFixed(1)}%)`}</title>
							</path>
						);
					})
				)}
				<text x={c} y={c - 8} textAnchor="middle" className="ptc-pie-big">
					{shown ? `${((shown.ms / total) * 100).toFixed(1)}%` : fmtDuration(total)}
				</text>
				<text x={c} y={c + 14} textAnchor="middle" className="ptc-pie-small">
					{shown ? fmtDuration(shown.ms) : 'total'}
				</text>
			</svg>
			<div className="ptc-legend">
				{slices.map((s) => (
					<div
						key={s.key}
						className={`ptc-legend-row${active === s.key ? ' active' : ''}`}
						onMouseEnter={() => setActive(s.key)}
						onMouseLeave={() => setActive(null)}
					>
						<span className="ptc-dot" style={{ background: s.color }} />
						<span className="ptc-legend-name">{s.label}</span>
						<span className="ptc-legend-time">{fmtDuration(s.ms)}</span>
						<span className="ptc-legend-pct">{((s.ms / total) * 100).toFixed(1)}%</span>
					</div>
				))}
			</div>
		</div>
	);
}
