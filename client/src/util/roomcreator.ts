import { API } from "@/common-http.js";
import { ToastStyle } from "@/models/toast";
import {
	OttResponseBody,
	OttApiResponseRoomGenerate,
	OttApiResponseRoomCreate,
	OttApiRequestRoomCreate,
} from "common/models/rest-api";
import type { Store } from "vuex";
import type { Ref } from "@vue/composition-api";

/** Generate a temporary room. */
export async function generateRoom(): Promise<OttApiResponseRoomGenerate> {
	let resp = await API.post("/room/generate");
	let data: OttResponseBody<OttApiResponseRoomGenerate> = resp.data;

	if (data.success) {
		return data;
	} else {
		throw new Error(`${data.error.name}: ${data.error.message}`);
	}
}

/** Create a room using the given options. */
export async function createRoom(
	options: OttApiRequestRoomCreate
): Promise<OttApiResponseRoomCreate> {
	let resp = await API.post("/room/create", options);
	let data: OttResponseBody<OttApiResponseRoomCreate> = resp.data;

	if (data.success) {
		return data;
	} else {
		throw new Error(`${data.error.name}: ${data.error.message}`);
	}
}

export interface RoomCreateState {
	isLoadingCreateRoom: boolean;
	cancelledRoomCreation: boolean;
}

/** Helper function to generate a temporary room, and then trigger a page navigation. */
export async function createRoomHelper(
	store: Store<unknown>,
	state: Ref<RoomCreateState>,
	options?: OttApiRequestRoomCreate
) {
	state.value.isLoadingCreateRoom = true;
	try {
		if (options) {
			await createRoom(options);
			if (state.value.cancelledRoomCreation) {
				state.value.isLoadingCreateRoom = false;
				return;
			}
			store.commit("misc/ROOM_CREATED", { name: options.name });
		} else {
			let resp = await generateRoom();
			if (state.value.cancelledRoomCreation) {
				state.value.isLoadingCreateRoom = false;
				return;
			}
			store.commit("misc/ROOM_CREATED", { name: resp.room });
		}
	} catch (err) {
		if (state.value.cancelledRoomCreation) {
			return;
		}
		console.error(err);
		store.commit("toast/ADD_TOAST", {
			style: ToastStyle.Error,
			content: `Failed to create a new temporary room`,
			duration: 6000,
		});
	}
	state.value.isLoadingCreateRoom = false;
}
