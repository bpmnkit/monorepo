export class AutoSave {
	private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly _latest = new Map<string, string>();
	private readonly _delay: number;
	private readonly _onSave: (fileId: string, content: string) => Promise<void>;

	constructor(onSave: (fileId: string, content: string) => Promise<void>, delay = 500) {
		this._onSave = onSave;
		this._delay = delay;
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") void this.flush();
		});
		window.addEventListener("beforeunload", () => void this.flush());
	}

	schedule(fileId: string, content: string): void {
		this._latest.set(fileId, content);
		const existing = this._timers.get(fileId);
		if (existing !== undefined) clearTimeout(existing);
		this._timers.set(
			fileId,
			setTimeout(() => {
				void this._save(fileId);
			}, this._delay),
		);
	}

	async flush(): Promise<void> {
		const entries = [...this._latest.entries()];
		for (const [fileId] of entries) {
			const timer = this._timers.get(fileId);
			if (timer !== undefined) clearTimeout(timer);
			this._timers.delete(fileId);
		}
		this._latest.clear();
		await Promise.all(entries.map(([id, content]) => this._onSave(id, content)));
	}

	private async _save(fileId: string): Promise<void> {
		const content = this._latest.get(fileId);
		if (content === undefined) return;
		this._latest.delete(fileId);
		this._timers.delete(fileId);
		await this._onSave(fileId, content);
	}
}
