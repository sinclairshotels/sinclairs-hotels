-- The credential on the guest's "Cancel this booking" link. Null on bookings
-- taken before it existed: those guests cancel from the booking page or by
-- telephone, which is what they have always done.
ALTER TABLE "Booking" ADD COLUMN "cancelToken" TEXT;
CREATE UNIQUE INDEX "Booking_cancelToken_key" ON "Booking"("cancelToken");
