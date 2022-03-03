export interface VuexMutation<T> {
	type: string;
	payload: T;
}
