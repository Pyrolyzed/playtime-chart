import { definePlugin, Field, Navigation, routerHook } from 'millennium';
import { useEffect, useState } from 'react';
import { PlaytimePage } from './PlaytimePage';
import { CSS } from './styles';
import { installSteamMenuItem, removeSteamMenuItem } from './steamMenu';
import { startTracking } from './tracker';

const ROUTE = '/playtimechart';
const LAUNCHER = 'PlaytimeChartLauncher';

const ChartIcon = () => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M4 6h9M8 12h12M3 18h7" />
	</svg>
);

function openPage() {
	Navigation.Navigate(ROUTE);
}

/** Small round button floating in the Steam window; hidden while the page itself is open. */
const Launcher = () => {
	const [onPage, setOnPage] = useState(window.location.pathname.startsWith(ROUTE));
	useEffect(() => {
		const t = setInterval(() => setOnPage(window.location.pathname.startsWith(ROUTE)), 500);
		return () => clearInterval(t);
	}, []);
	if (onPage) return null;
	return (
		<>
			<style>{CSS}</style>
			<button className="ptc-launcher" title="Playtime Chart" onClick={openPage}>
				<ChartIcon />
			</button>
		</>
	);
};

const SettingsContent = () => (
	<Field label="Playtime Chart" description="Sessions are recorded automatically while this plugin is enabled." onClick={openPage}>
		<button onClick={openPage}>Open</button>
	</Field>
);

export default definePlugin(() => {
	startTracking();
	routerHook.addRoute(ROUTE, () => (
		<div style={{ position: 'relative', width: '100%', height: '100%' }}>
			<PlaytimePage />
		</div>
	));
	routerHook.addGlobalComponent(LAUNCHER, Launcher);
	installSteamMenuItem(openPage);

	return {
		title: 'Playtime Chart',
		icon: <ChartIcon />,
		content: <SettingsContent />,
		onDismount() {
			routerHook.removeRoute(ROUTE);
			routerHook.removeGlobalComponent(LAUNCHER);
			removeSteamMenuItem();
		},
	};
});
