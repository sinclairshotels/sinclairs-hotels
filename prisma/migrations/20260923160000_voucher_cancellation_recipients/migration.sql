-- Cancelling a voucher and cancelling a booking are different news for
-- different people: one is a document withdrawn, the other is money owed. They
-- get their own lists rather than sharing CANCELLATION, which stays as the
-- booking one.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'VOUCHER_CANCELLATION';
