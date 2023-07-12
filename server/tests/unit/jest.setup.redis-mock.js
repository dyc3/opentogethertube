import mockredis from "./redisV4Mock";
jest.mock("redis", () => mockredis);
