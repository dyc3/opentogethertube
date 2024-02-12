import mockredis from "./redisV4Mock";
vitest.mock("redis", () => mockredis);
