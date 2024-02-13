import { vi } from "vitest";
import mockredis from "./redisV4Mock";
vi.mock("redis", () => {
	return {
		default: mockredis,
	};
});
