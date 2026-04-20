BEGIN;
SET LOCAL work_mem = '4MB';

-- because the LIMIT clause is not supported on DELETE for some strange reason
WITH rows AS (
	SELECT id
	FROM "CachedVideos"
	WHERE "CachedVideos"."updatedAt" < NOW() - INTERVAL '30 days'
	ORDER BY "CachedVideos"."updatedAt"
	LIMIT 1000
), deleted AS (
	DELETE FROM "CachedVideos"
	WHERE id IN (SELECT id FROM rows)
	RETURNING 1
)
SELECT COUNT(*) FROM deleted;

COMMIT;
