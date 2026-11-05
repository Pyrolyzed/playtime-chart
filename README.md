# Playtime Chart (Millennium plugin)

An entirely vibe-coded Millennium plugin, posted to GitHub with absolutely zero shame.
Records every Steam play session and charts it.

**Tracked per session:** start time, end time, duration, date. Stored in
`<Steam>/config/playtimechart/sessions.jsonl` by default (one JSON object per line,
append-only). If Steam or the PC crashes mid-game, the session is closed at its last
30-second heartbeat on the next launch, so no time is invented.

**Data folder:** Millennium settings → Playtime Chart → Data folder moves
`sessions.jsonl` elsewhere, such as a network share, so your history survives a
reinstall: after reinstalling, point the setting at the same folder again.

- Changing the folder merges the current sessions into the new one by session id and
  keeps what is already there. The old file is left in place.
- If the folder is unreachable, finished sessions wait in `pending.jsonl` on this PC and
  move over once it is back. The chart shows only those sessions until then.
- The setting and running-session state stay in `<Steam>/config/playtimechart`, per PC.
  PCs can share a folder, but use a UNC path (`\\server\share\Playtime`) if Steam might
  start before a mapped drive reconnects.

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

**Selecting several games:** in the Library, Ctrl+click toggles a game and Shift+click
selects a range. The selected games share one view, each in its own colour: the timeline
and the weekday and hour bars are merged, and total playtime is their sum. Average session
is the average of each game's own average, and longest session is the longest of any of them.

**Resetting games:** right-click a game in either view and choose *Reset playtime data* to
permanently remove all its recorded sessions, across every date range. Right-clicking one of
several selected games in the Library resets all of them. Steam's own playtime isn't changed.
This is unavailable while a chosen game is running or the data folder is unreachable.

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
| `frontend/gameMenu.tsx` | right-click menu and reset confirmation |
| `frontend/StorageSettings.tsx` | data folder setting |
| `frontend/index.tsx` | plugin entry: route, launcher button, settings entry |
