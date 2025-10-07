export class Dirtyable {
	private _dirty = false;
	private callback: (() => void) | undefined = undefined;

	// biome-ignore lint/complexity/noUselessConstructor: biome migration
	// biome-ignore lint/suspicious/noEmptyBlockStatements: biome migration
		constructor() {}

	get dirty() {
		return this._dirty;
	}

	markDirty() {
		this._dirty = true;
		if (this.callback) {
			this.callback();
		}
	}

	clean() {
		this._dirty = false;
	}

	/**
	 * Call the given function when the object is marked as dirty. Only one callback can be active at a time.
	 * @param cb The function to call when the object is marked as dirty.
	 */
	onDirty(cb: (() => void) | undefined) {
		this.callback = cb;
	}
}
