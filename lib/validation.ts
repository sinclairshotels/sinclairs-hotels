import { z } from 'zod';

export const enquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(120),
  email: z.string().trim().email('Please enter a valid email address').max(200),
  phone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number')
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, 'Please enter a valid phone number'),
  property: z.string().trim().min(1, 'Please select a property').max(60),
  type: z.enum(['GENERAL', 'HOTEL', 'WEDDING', 'MEETINGS']).catch('GENERAL'),
  checkIn: z.string().trim().max(10).optional().or(z.literal('')),
  checkOut: z.string().trim().max(10).optional().or(z.literal('')),
  guests: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().int().min(1).max(20).optional(),
  ),
  message: z.string().trim().min(10, 'Please add a few details about your stay').max(2000),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;

const emptyToUndefined = (val: unknown) =>
  val === '' || val === undefined || val === null ? undefined : val;
const optionalPercent = () =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional());
const optionalMoney = () => z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional());
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const voucherSchema = z.object({
  hotelSlug: z.string().trim().min(1, 'Please select a hotel').max(60),
  guestName: z.string().trim().min(2, 'Please enter the guest name').max(120),
  guestPhone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number')
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, 'Please enter a valid phone number'),
  guestEmail: z.string().trim().email('Please enter a valid email address').max(200),
  billingAddress: z.string().trim().min(5, 'Please enter a billing address').max(500),
  travelAgentName: optionalTrimmed(160),
  travelAgentPan: optionalTrimmed(20),
  travelAgentGstin: optionalTrimmed(20),
  travelAgentState: optionalTrimmed(60),
  commissionPct: optionalPercent(),
  tdsPct: optionalPercent(),
  rooms: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(50)),
  checkIn: z.string().trim().min(1, 'Please select a check-in date').max(10),
  checkOut: z.string().trim().min(1, 'Please select a check-out date').max(10),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().min(0)),
  taxes: z.preprocess(emptyToUndefined, z.coerce.number().min(0)),
  depositAmount: optionalMoney(),
  depositReceiptNo: optionalTrimmed(60),
  depositReceiptDate: z.string().trim().max(10).optional().or(z.literal('')),
  billingInstructions: optionalTrimmed(2000),
  arrivalDetails: optionalTrimmed(1000),
  otherServices: optionalTrimmed(1000),
  specialInstructions: optionalTrimmed(1000),
  issuerName: z.string().trim().min(2, 'Please enter your name').max(120),
  issuerPhone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number')
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, 'Please enter a valid phone number'),
  bookingOffice: z.string().trim().min(1, 'Please select a booking office').max(120),
});

export type VoucherInput = z.infer<typeof voucherSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(200),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

export const ipaySchema = z.object({
  hotelSlug: z.string().trim().min(1, 'Please select a hotel').max(60),
  amount: z.coerce.number().positive('Please enter an amount').max(1_000_000),
  guestName: z.string().trim().min(2, 'Please enter your full name').max(120),
  guestEmail: z.string().trim().email('Please enter a valid email address').max(200),
  guestPhone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number')
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, 'Please enter a valid phone number'),
  billingAddress: optionalTrimmed(500),
  remark: optionalTrimmed(500),
  reservationNo: optionalTrimmed(20),
  checkIn: z.string().trim().max(10).optional().or(z.literal('')),
  checkOut: z.string().trim().max(10).optional().or(z.literal('')),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type IpayInput = z.infer<typeof ipaySchema>;

export const refundSchema = z.object({
  orderId: z.string().trim().min(1),
  amount: z.coerce.number().positive('Please enter an amount').max(1_000_000),
});

export type RefundInput = z.infer<typeof refundSchema>;

const phoneField = (message = 'Please enter a valid phone number') =>
  z
    .string()
    .trim()
    .min(7, message)
    .max(20)
    .regex(/^[0-9+()\-\s]+$/, message);

const dateOnlyField = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message);

// The stay itself, shared by the availability page's query string and the
// booking submission — both are guest-supplied and neither is trusted.
// Whether the dates make sense relative to each other and to today is
// checked against real rate rows in lib/availability.ts, not here.
export const staySchema = z.object({
  hotelSlug: z.string().trim().min(1, 'Please select a property').max(60),
  checkIn: dateOnlyField('Please select a check-in date'),
  checkOut: dateOnlyField('Please select a check-out date'),
  rooms: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).catch(1)),
  adults: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(20).catch(2)),
  children: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(20).catch(0)),
});

export type StayInput = z.infer<typeof staySchema>;

export const bookingSchema = staySchema.extend({
  roomName: z.string().trim().min(1, 'Please choose a room').max(120),
  guestName: z.string().trim().min(2, 'Please enter your full name').max(120),
  guestEmail: z.string().trim().email('Please enter a valid email address').max(200),
  guestPhone: phoneField(),
  billingAddress: z.string().trim().min(5, 'Please enter your address').max(500),
  specialRequests: optionalTrimmed(1000),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type BookingInput = z.infer<typeof bookingSchema>;

const checkboxField = () =>
  z.preprocess((val) => val === 'on' || val === 'true' || val === true, z.boolean());

// One /admin/rates submission writes rate + inventory across a date range
// for a single room type, which is how staff actually think about a season.
export const rateGridSchema = z.object({
  hotelSlug: z.string().trim().min(1, 'Please select a hotel').max(60),
  roomName: z.string().trim().min(1, 'Please select a room type').max(120),
  from: dateOnlyField('Please select a start date'),
  to: dateOnlyField('Please select an end date'),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1_000_000)),
  totalRooms: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(500)),
  closed: checkboxField(),
  // 0 (Sunday) to 6. Empty means every night in the range — the common case,
  // and what a form with no boxes ticked should mean rather than "no nights".
  weekdays: z.preprocess(
    (val) => (Array.isArray(val) ? val : val === undefined || val === null ? [] : [val]),
    z.array(z.coerce.number().int().min(0).max(6)).max(7),
  ),
  // Staff see what a load would overwrite before it happens; the write only
  // goes ahead on the second, confirmed submission.
  confirmed: checkboxField(),
});

export type RateGridInput = z.infer<typeof rateGridSchema>;
