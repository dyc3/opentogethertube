-- because the LIMIT clause is not supported on DELETE for some strange reason
WITH rows AS (SELECT id FROM "CachedVideos" WHERE "CachedVideos"."updatedAt" < NOW() - INTERVAL '30 days' LIMIT 10000) DELETE FROM "CachedVideos" WHERE id in (SELECT id FROM rows);
