-- GENERAL was one list serving both enquiry and booking mail. Those are now
-- separate pages with separate lists, so every GENERAL address is copied into
-- both rather than being assigned to one and silently lost from the other.
-- The GENERAL rows stay where they are: nothing reads them any more, and
-- deleting the only record of what was configured would make this migration
-- impossible to check afterwards.
INSERT INTO "NotificationEmail" ("id", "hotelSlug", "kind", "field", "address", "createdAt")
SELECT
    'nefld_' || substr(md5(random()::text || n."id" || k.kind), 1, 20),
    n."hotelSlug",
    k.kind::"NotificationKind",
    'TO',
    n."address",
    n."createdAt"
FROM "NotificationEmail" n
CROSS JOIN (VALUES ('ENQUIRY'), ('BOOKING')) AS k(kind)
WHERE n."kind" = 'GENERAL';

-- One address per header per page per property. Two partial indexes because
-- Postgres counts NULLs as distinct, so a single unique index would let the
-- central list hold the same address twice.
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationEmail_hotel_unique"
    ON "NotificationEmail" ("hotelSlug", "kind", "field", "address")
    WHERE "hotelSlug" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationEmail_central_unique"
    ON "NotificationEmail" ("kind", "field", "address")
    WHERE "hotelSlug" IS NULL;
