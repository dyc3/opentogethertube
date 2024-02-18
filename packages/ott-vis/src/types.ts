type SeriesSize = "sm" | "md" | "lg";

export interface CoreOptions {
	view: "global" | "region";
	text: string;
	showSeriesCount: boolean;
	seriesCountSize: SeriesSize;
}
