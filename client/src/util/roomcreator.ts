import { API } from "@/common-http.js";
import { ToastStyle } from "@/models/toast";
import {
	OttResponseBody,
	OttApiResponseRoomGenerate,
	OttApiResponseRoomCreate,
	OttApiRequestRoomCreate,
} from "common/models/rest-api";
import type { Store } from "vuex";
import { reactive, Ref, ref } from "vue";
import { AxiosResponse } from "axios";
import type { FullOTTStoreState } from "@/store";

/** Generate a temporary room. */
export async function generateRoom(): Promise<OttApiResponseRoomGenerate> {
	let resp = await API.post("/room/generate", undefined, {
		validateStatus: status => status >= 200 && status < 400,
	});
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
	let resp = await API.post("/room/create", options, {
		validateStatus: status => status >= 200 && status < 400,
	});
	let data: OttResponseBody<OttApiResponseRoomCreate> = resp.data;

	if (data.success) {
		return data;
	} else {
		throw new Error(`${data.error.name}: ${data.error.message}`);
	}
}

/** Helper function to generate a temporary room, and then trigger a page navigation. */
export async function createRoomHelper(
	store: Store<FullOTTStoreState>,
	options?: OttApiRequestRoomCreate
) {
	store.commit("misc/CREATING_ROOM");
	try {
		if (options) {
			await createRoom(options);
			if (store.state.misc.cancelledRoomCreation) {
				return;
			}
			store.commit("misc/ROOM_CREATED", { name: options.name });
			return options.name;
		} else {
			let resp = await generateRoom();
			if (store.state.misc.cancelledRoomCreation) {
				return;
			}
			store.commit("misc/ROOM_CREATED", { name: resp.room });
			return resp.room;
		}
	} catch (err) {
		if (store.state.misc.cancelledRoomCreation) {
			return;
		}
		store.commit("misc/ROOM_CREATE_FAILED");
		console.error(err);
		store.commit("toast/ADD_TOAST", {
			style: ToastStyle.Error,
			content: `Failed to create a new room`,
			duration: 6000,
		});
		throw err;
	}
}
