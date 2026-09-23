-- Dates a property sells on non-refundable terms only. Replaces the Port Blair
-- blackout and the peak-season exception that content/legal.ts used to state in
-- prose: prose could not stop the booking engine offering a refundable rate
-- over Christmas, and this can.
CREATE TABLE IF NOT EXISTS "NonRefundableWindow" (
    "id"        TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate"   DATE NOT NULL,
    "label"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonRefundableWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NonRefundableWindow_hotelSlug_startDate_idx"
    ON "NonRefundableWindow"("hotelSlug", "startDate");

-- Port Blair's 15 Dec – 15 Jan peak, carried over from the clause it replaces.
-- Two seasons, because these are dates and not a rule that repeats itself; the
-- Set-up screen says so when they are about to run out.
INSERT INTO "NonRefundableWindow" ("id", "hotelSlug", "startDate", "endDate", "label")
VALUES
    ('nrw_portblair_2026', 'port-blair', DATE '2026-12-15', DATE '2027-01-15', 'Peak season'),
    ('nrw_portblair_2027', 'port-blair', DATE '2027-12-15', DATE '2028-01-15', 'Peak season')
ON CONFLICT ("id") DO NOTHING;
