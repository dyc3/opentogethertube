/* eslint-disable vitest/expect-expect */
import { describe, it, expectTypeOf } from "vitest";
import type { ServerMessageSync } from "ott-common/models/messages.js";
import type { RoomStateSyncable } from "../../room.js";
import type { ConvertToJsonSafe } from "ott-common/serialize.js";

describe("room state types", () => {
	it("should always keep RoomStateSyncable and ServerMessageSync in sync", () => {
		type B =
			| "name"
			| "title"
			| "description"
			| "isTemporary"
			| "visibility"
			| "queueMode"
			| "currentSource"
			| "queue"
			| "isPlaying"
			| "playbackPosition"
			| "playbackSpeed"
			| "grants"
			| "hasOwner"
			| "voteCounts"
			| "videoSegments"
			| "autoSkipSegmentCategories"
			| "prevQueue"
			| "restoreQueueBehavior"
			| "enableVoteSkip"
			| "votesToSkip";
		type ExMsg = Pick<ServerMessageSync, B>;
		type ExRoom = Pick<Partial<ConvertToJsonSafe<RoomStateSyncable>>, B>;
		expectTypeOf<ExMsg>().toEqualTypeOf<ExRoom>();

		expectTypeOf<Omit<ServerMessageSync, "action">>().toEqualTypeOf<
			Partial<ConvertToJsonSafe<RoomStateSyncable>>
		>();
	});
});
