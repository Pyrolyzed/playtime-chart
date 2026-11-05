export const CSS = `
.ptc-root {
	--ptc-bg: #171d25;
	--ptc-panel: #1f2733;
	--ptc-panel2: #26303e;
	--ptc-line: #33404f;
	--ptc-text: #dcdedf;
	--ptc-dim: #8f98a0;
	--ptc-accent: #66c0f4;
	position: relative; width: 100%; height: 100%;
	display: flex; flex-direction: column;
	background: var(--ptc-bg); color: var(--ptc-text);
	font-family: "Motiva Sans", Arial, sans-serif; font-size: 14px;
	overflow: hidden; box-sizing: border-box;
}
.ptc-root *, .ptc-root *::before, .ptc-root *::after { box-sizing: border-box; }
.ptc-top {
	display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;
	padding: 14px 20px; border-bottom: 1px solid var(--ptc-line); background: var(--ptc-panel);
}
.ptc-title { font-size: 18px; font-weight: 600; margin-right: 8px; }
.ptc-tabs, .ptc-presets { display: flex; gap: 4px; }
.ptc-btn {
	background: var(--ptc-panel2); color: var(--ptc-text); border: 1px solid transparent;
	padding: 6px 12px; border-radius: 3px; cursor: pointer; font: inherit;
}
.ptc-btn:hover { background: #313e50; }
.ptc-btn.on { background: var(--ptc-accent); color: #0e1a24; font-weight: 600; }
.ptc-top input[type=date] {
	background: var(--ptc-panel2); color: var(--ptc-text); border: 1px solid var(--ptc-line);
	border-radius: 3px; padding: 5px 8px; font: inherit; color-scheme: dark;
}
.ptc-spacer { flex: 1; }
.ptc-warn { padding: 8px 20px; background: #4a3a1a; color: #f0d48a; font-size: 12px; border-bottom: 1px solid var(--ptc-line); }
.ptc-body { flex: 1; min-height: 0; display: flex; }
.ptc-scroll { overflow-y: auto; min-height: 0; }

/* library */
.ptc-library { flex: 1 1 46%; min-width: 320px; display: flex; flex-direction: column; border-right: 1px solid var(--ptc-line); }
.ptc-tools { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--ptc-line); }
.ptc-tools input[type=text], .ptc-tools select {
	background: var(--ptc-panel2); color: var(--ptc-text); border: 1px solid var(--ptc-line);
	border-radius: 3px; padding: 5px 8px; font: inherit;
}
.ptc-tools input[type=text] { flex: 1; min-width: 0; }
.ptc-tools input[type=range] { width: 90px; }
.ptc-grid { display: grid; gap: 14px; padding: 14px; align-content: start; flex: 1; }
.ptc-card { cursor: pointer; border-radius: 4px; outline: 2px solid transparent; transition: transform .1s; user-select: none; }
.ptc-card:hover { transform: translateY(-2px); }
.ptc-card.sel { outline-color: var(--ptc-accent); }
.ptc-cover { position: relative; aspect-ratio: 2 / 3; background: var(--ptc-panel2); border-radius: 4px; overflow: hidden; }
.ptc-capsule-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ptc-capsule-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #0e1a24; }
.ptc-all-cover { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; text-align: center; padding: 8px; background: linear-gradient(160deg, #2a475e, #1b2838); }
.ptc-badge { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 8px 6px; font-size: 12px; font-weight: 600; background: linear-gradient(transparent, rgba(0,0,0,.85)); }
.ptc-live-dot { position: absolute; top: 6px; right: 6px; background: #5ba32b; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; }
.ptc-card-name { margin-top: 6px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ptc-text); }

/* detail */
.ptc-detail { flex: 1 1 54%; min-width: 360px; padding: 16px 20px 24px; display: flex; flex-direction: column; gap: 16px; }
.ptc-detail h2 { margin: 0; font-size: 22px; font-weight: 600; }
.ptc-sub { color: var(--ptc-dim); font-size: 12px; margin-top: 2px; }
.ptc-sel-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; }
.ptc-sel-legend-item { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ptc-sel-legend-time { color: var(--ptc-dim); }
.ptc-section-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-weight: 600; }
.ptc-section-head label { font-weight: 400; color: var(--ptc-dim); font-size: 12px; display: flex; gap: 6px; align-items: center; }

.ptc-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.ptc-tile { background: var(--ptc-panel); border: 1px solid var(--ptc-line); border-radius: 4px; padding: 10px 12px; }
.ptc-tile-label { color: var(--ptc-dim); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.ptc-tile-value { font-size: 20px; font-weight: 600; margin-top: 2px; }
.ptc-tile-sub { color: var(--ptc-dim); font-size: 11px; margin-top: 2px; }
.ptc-minibars-wrap { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-top: 8px; }
.ptc-minibars { background: var(--ptc-panel); border: 1px solid var(--ptc-line); border-radius: 4px; padding: 10px 12px; }
.ptc-minibars-row { display: flex; gap: 3px; height: 70px; margin-top: 6px; }
.ptc-minibar-col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.ptc-minibar-track { flex: 1; display: flex; align-items: flex-end; }
.ptc-minibar-stack { width: 100%; min-height: 1px; display: flex; flex-direction: column; border-radius: 2px 2px 0 0; overflow: hidden; }
.ptc-minibar-fill { flex: 1 1 0; background: var(--ptc-accent); opacity: .85; }
.ptc-minibar-label { font-size: 10px; color: var(--ptc-dim); text-align: center; height: 13px; white-space: nowrap; overflow: visible; }

/* gantt */
.ptc-gantt { background: var(--ptc-panel); border: 1px solid var(--ptc-line); border-radius: 4px; padding: 8px 10px 6px; }
.ptc-gantt-head, .ptc-gantt-row { display: flex; align-items: center; gap: 8px; }
.ptc-gantt-label { width: 104px; flex: none; font-size: 12px; color: var(--ptc-dim); }
.ptc-gantt-total { width: 56px; flex: none; font-size: 11px; color: var(--ptc-dim); text-align: right; }
.ptc-gantt-axis { position: relative; flex: 1; height: 16px; font-size: 10px; color: var(--ptc-dim); }
.ptc-gantt-axis span { position: absolute; transform: translateX(-50%); }
.ptc-gantt-body { max-height: 420px; overflow-y: auto; }
.ptc-gantt-row { height: 24px; border-top: 1px solid rgba(255,255,255,.04); }
.ptc-gantt-track {
	position: relative; flex: 1; height: 16px; border-radius: 2px;
	background-color: rgba(255,255,255,.03);
	background-image: repeating-linear-gradient(90deg, transparent 0, transparent calc(12.5% - 1px), rgba(255,255,255,.07) calc(12.5% - 1px), rgba(255,255,255,.07) 12.5%);
}
.ptc-bar { position: absolute; top: 1px; bottom: 1px; min-width: 2px; background: var(--ptc-accent); border-radius: 2px; cursor: default; }
.ptc-bar:hover { filter: brightness(1.3); }
.ptc-bar.live { animation: ptc-pulse 1.6s ease-in-out infinite; }
@keyframes ptc-pulse { 50% { opacity: .55; } }
.ptc-gantt-hover { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--ptc-line); font-size: 12px; color: var(--ptc-dim); min-height: 20px; }
.ptc-gantt-hover b { color: var(--ptc-text); }
.ptc-empty { color: var(--ptc-dim); padding: 30px 10px; text-align: center; }

/* pie page */
.ptc-pie-page { flex: 1; padding: 20px 28px; display: flex; flex-direction: column; gap: 16px; }
.ptc-pie { display: flex; flex-wrap: wrap; gap: 28px; align-items: center; justify-content: center; }
.ptc-pie-svg { width: min(360px, 90%); flex: none; }
.ptc-pie-svg path, .ptc-pie-svg circle { transition: d .1s; cursor: pointer; }
.ptc-pie-big { fill: var(--ptc-text); font-size: 26px; font-weight: 600; }
.ptc-pie-small { fill: var(--ptc-dim); font-size: 13px; }
.ptc-legend { flex: 1 1 320px; max-width: 520px; display: flex; flex-direction: column; }
.ptc-legend-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 3px; }
.ptc-legend-row.active { background: var(--ptc-panel2); }
.ptc-dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.ptc-legend-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ptc-legend-time { color: var(--ptc-dim); width: 74px; text-align: right; }
.ptc-legend-pct { width: 56px; text-align: right; font-weight: 600; }

.ptc-launcher {
	position: fixed; right: 14px; bottom: 14px; z-index: 9999;
	width: 34px; height: 34px; border-radius: 50%; border: 1px solid #33404f;
	background: #1f2733; color: #66c0f4; cursor: pointer; display: flex; align-items: center; justify-content: center;
	opacity: .55; transition: opacity .15s;
}
.ptc-launcher:hover { opacity: 1; }
`;
