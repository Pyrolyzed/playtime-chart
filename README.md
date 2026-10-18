# Playtime Chart (Millennium plugin)

An entirely vibe-coded Millennium plugin, posted to GitHub with absolutely zero shame.
Records every Steam play session and charts it.

**Tracked per session:** start time, end time, duration, date. Stored in
`<Steam>/config/playtimechart/sessions.jsonl` (one JSON object per line, append-only).
If Steam or the PC crashes mid-game, the session is closed at its last 30-second
heartbeat on the next launch, so no time is invented.

**Views** (open via the round button in the bottom-right of the Steam window, or
Millennium settings → Playtime Chart → Open):

- **Library** – grid of game icons (capsule art, with playtime for the chosen
  range). Pick *All games* or a single game to see:
  - aggregate stats: total, session count, average/median/longest session, days
    played, daily average, streaks, busiest day, first/last played, by-weekday
    and by-hour-of-day bars
  - a Gantt chart: one row per day, x-axis is time of day, one bar per session
    (sessions crossing midnight are split; running games pulse)
- **Distribution** – donut/pie chart of the share of playtime per game in the
  chosen range (top 11 games, the rest grouped as "Other").

Date range presets: Today, 7/30/90 days, 1 year, All time, or Custom dates.
The range applies to both views.

## Build

Requires Millennium >= 3.4.0 and [Bun](https://bun.com/).

```bash
bun install
bun run build
```

Enable the plugin in Millennium settings and restart Steam. Only games played
while the plugin is enabled are recorded.

## Layout

| Path | Purpose |
| --- | --- |
| `backend/storage.lua` | session persistence + crash recovery |
| `backend/rpc_functions.lua` | `backend.pt*` calls used by the frontend |
| `frontend/tracker.ts` | listens to `SteamClient.GameSessions` app lifetime events |
| `frontend/data.ts` | ranges, aggregation, statistics (pure functions) |
| `frontend/charts.tsx` | capsule, stats, Gantt, pie components |
| `frontend/PlaytimePage.tsx` | the page (library grid, detail, distribution) |
| `frontend/index.tsx` | plugin entry: route, launcher button, settings entry |
