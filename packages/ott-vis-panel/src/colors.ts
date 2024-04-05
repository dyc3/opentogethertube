class ColorProvider {
	public assign(thing: string): string {
		// TODO: implement
		return "";
	}

	public assignments(): Map<string, string> {
		// TODO: implement
		return new Map();
	}
}

const provider = new ColorProvider();

export function useColorProvider(): ColorProvider {
	return provider;
}
