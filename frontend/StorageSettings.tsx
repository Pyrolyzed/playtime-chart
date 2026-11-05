import { DialogButton, Field, TextField } from 'millennium';
import { useEffect, useState } from 'react';
import { SetDataDirResult, StorageInfo, getStorageInfo, setDataDir } from './tracker';

const BUTTON = { width: 'auto', minWidth: 90 };

function describe(result: SetDataDirResult): string {
	if (!result.ok) return result.error ?? 'Could not change the data folder.';
	if (result.source_unreachable) return 'Folder changed. The previous folder is unreachable, so its sessions were not copied.';
	return `Folder changed. Copied ${result.copied} session${result.copied === 1 ? '' : 's'} that it did not already have.`;
}

/** Settings row for choosing where sessions.jsonl is stored. */
export const StorageSettings = () => {
	const [info, setInfo] = useState<StorageInfo | null>(null);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState('');

	useEffect(() => {
		getStorageInfo()
			.then((i) => {
				setInfo(i);
				setDraft(i.dir);
			})
			.catch((e) => setMessage(`Could not read the storage settings: ${e}`));
	}, []);

	const apply = async (path: string) => {
		setBusy(true);
		setMessage('');
		try {
			const result = await setDataDir(path);
			setMessage(describe(result));
			if (result.info) {
				setInfo(result.info);
				setDraft(result.info.dir);
			}
		} catch (e) {
			setMessage(`Could not change the data folder: ${e}`);
		} finally {
			setBusy(false);
		}
	};

	const browse = async () => {
		try {
			const picked = await (window as any).SteamClient.System.OpenFileDialog({
				bChooseDirectory: true,
				strTitle: 'Choose a folder for playtime data',
				strInitialFile: draft,
			});
			if (typeof picked === 'string' && picked) setDraft(picked);
		} catch {
			/* the dialog rejects when cancelled */
		}
	};

	const unchanged = !info || draft.trim() === info.dir;

	return (
		<>
			<TextField
				label="Data folder"
				description="Where play sessions are stored and read from. Pick a network share or another drive to keep them between installs. Sessions from the current folder are merged in, and any already in the new folder are kept."
				value={draft}
				disabled={busy}
				onChange={(e) => setDraft(e.target.value)}
			/>
			<Field
				description={
					<>
						{info && !info.available && <div>This folder is unreachable. New sessions are kept on this PC and moved there once it is back.</div>}
						{message && <div>{message}</div>}
					</>
				}
			>
				<div style={{ display: 'flex', gap: 8 }}>
					<DialogButton style={BUTTON} disabled={busy} onClick={browse}>
						Browse
					</DialogButton>
					<DialogButton style={BUTTON} disabled={busy || unchanged} onClick={() => apply(draft)}>
						Apply
					</DialogButton>
					<DialogButton style={BUTTON} disabled={busy || !info?.custom} onClick={() => apply('')}>
						Use default
					</DialogButton>
				</div>
			</Field>
		</>
	);
};
