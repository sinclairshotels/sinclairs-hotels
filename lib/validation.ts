import { addressSchema } from '@/lib/address';
import { z } from 'zod';

const optionalTrimmedEarly = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

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
  type: z.enum(['GENERAL', 'HOTEL', 'WEDDING', 'MEETINGS', 'GROUP']).catch('GENERAL'),
  city: z
    .string()
    .trim()
    .max(80)
    .regex(/^[A-Za-z\s'.-]*$/, 'City should be letters only')
    .optional()
    .or(z.literal('')),
  // Six digits, and an Indian PIN never starts at zero.
  pinCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Please enter a 6-digit PIN code')
    .optional()
    .or(z.literal('')),
  replyChannel: z.enum(['WHATSAPP', 'PHONE', 'EMAIL']).catch('EMAIL'),
  flexibility: optionalTrimmedEarly(40),
  roomsNeeded: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().int().min(1).max(400).optional(),
  ),
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
  ...addressSchema.shape,
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
  // Ids, not names: a room type can be renamed between the guest seeing it and
  // submitting, and the booking must still land on the room they picked.
  roomTypeId: z.string().trim().min(1, 'Please choose a room').max(40),
  ratePlanId: z.string().trim().min(1, 'Please choose a rate').max(40),
  // Which terms the guest picked. The price for them is computed server-side
  // from this, so the form still posts no money of its own.
  rateType: z.enum(['NON_REFUNDABLE', 'REFUNDABLE']).catch('NON_REFUNDABLE'),
  guestName: z.string().trim().min(2, 'Please enter your full name').max(120),
  guestEmail: z.string().trim().email('Please enter a valid email address').max(200),
  guestPhone: phoneField(),
  // Six fields rather than one line, shared with the voucher form. The stored
  // column is still one string — lib/address.ts writes it — so every existing
  // row stays readable.
  ...addressSchema.shape,
  specialRequests: optionalTrimmed(1000),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type BookingInput = z.infer<typeof bookingSchema>;

const checkboxField = () =>
  z.preprocess((val) => val === 'on' || val === 'true' || val === true, z.boolean());

// A month of a room's baseline: what every night in it is on sale at, and for
// how much. Both are optional — filling one and leaving the other blank is how
// staff change an allotment without touching the price.
export const monthlyCellSchema = z.object({
  roomTypeId: z.string().trim().min(1).max(40),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Not a month'),
  roomsOnSale: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(500).optional()),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10_000_000).optional()),
});

export const monthlyRatesSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  // One JSON blob rather than parallel arrays: a table of 12 months by up to a
  // dozen rooms is 288 inputs, and matching them back up by index is how a
  // silently mismatched row gets written to the wrong month.
  cells: z.string().min(2).max(200_000),
  // What to do about dates a daily save has already overridden. Nothing is
  // written until staff have answered this, which is why it has no default.
  overrides: z.enum(['keep', 'replace']),
  confirmed: checkboxField(),
});

export type MonthlyRatesInput = z.infer<typeof monthlyRatesSchema>;
export type MonthlyCellInput = z.infer<typeof monthlyCellSchema>;

// One night, overriding whatever the month laid down.
export const dailyRateSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  roomTypeId: z.string().trim().min(1).max(40),
  date: dateOnlyField('Pick a date'),
  roomsOnSale: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(500).optional()),
  rate: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10_000_000).optional()),
});

export type DailyRateInput = z.infer<typeof dailyRateSchema>;

// The Set-up screen: one hotel-wide field, plus a room's name and occupancy.
export const hotelSetupSchema = z
  .object({
    hotelSlug: z.string().trim().min(1).max(60),
    breakfastSupplement: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0).max(100_000).default(0),
    ),
    // Left blank together, these mean the property sells no refundable rate.
    refundableUpliftPct: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0).max(100).optional(),
    ),
    freeCancellationDays: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(365).optional(),
    ),
  })
  // Half a policy is the dangerous state: an uplift with no deadline charges
  // for flexibility that never arrives, and a deadline with no uplift gives it
  // away silently. Refuse the pair rather than guess the missing half.
  .refine(
    (data) =>
      (data.refundableUpliftPct === undefined) === (data.freeCancellationDays === undefined),
    {
      message: 'Set both the uplift and the free-cancellation days, or leave both blank.',
      path: ['refundableUpliftPct'],
    },
  );

export const roomTypeSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  roomTypeId: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2, 'A room needs a name').max(80),
  baseOccupancy: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10)),
  maxAdults: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(10)),
  maxChildren: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(10)),
  extraAdultCharge: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1_000_000)),
  extraChildCharge: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1_000_000)),
  // Optional, and blank means "not measured" rather than zero: ten of the
  // thirty-nine rooms have no figure, and storing 0 would print "0 m² · 0 sq ft"
  // on the tile.
  sizeSqFt: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(50, 'A room is bigger than that').max(20_000).optional(),
  ),
});

// Dates come in as strings and are parsed with parseDateOnly in the action, so
// a real-looking but non-existent date ("2026-02-30") is rejected rather than
// rolled forward into a window nobody asked for.
export const nonRefundableWindowSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10),
  label: z.string().trim().max(60).optional().or(z.literal('')),
});

export const cancelVoucherSchema = z.object({
  id: z.string().trim().min(1).max(40),
  // A reason is required: "cancelled" alone loses the only thing anybody asks
  // afterwards, which is why.
  reason: z.string().trim().min(3, 'Please say why it is being cancelled').max(300),
});

export const recipientSchema = z.object({
  kind: z.enum([
    'BOOKING',
    'VOUCHER',
    'VOUCHER_CANCELLATION',
    'PAYMENT',
    'CANCELLATION',
    'ENQUIRY',
    'CAREERS',
  ]),
  field: z.enum(['TO', 'CC', 'BCC']),
  hotelSlug: z.string().trim().max(60).optional().or(z.literal('')),
  address: z.string().trim().email('Please enter a valid email address').max(200),
});

export const addRoomTypeSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2, 'A room needs a name').max(80),
});

export const deactivateRoomTypeSchema = z.object({
  hotelSlug: z.string().trim().min(1).max(60),
  roomTypeId: z.string().trim().min(1).max(40),
});

// GST. Admin-only, and audited, because a typo here re-prices every quote
// made after it.
export const taxSettingSchema = z.object({
  threshold: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10_000_000)),
  lowRate: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100)),
  highRate: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100)),
  effectiveFrom: dateOnlyField('Pick the date it takes effect'),
});

export type HotelSetupInput = z.infer<typeof hotelSetupSchema>;
export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
export type TaxSettingInput = z.infer<typeof taxSettingSchema>;

// A job application. The CV itself is checked in lib/careers-storage.ts, not
// here: zod sees a File, and what makes a file safe is its type, size and the
// fact its name never becomes a path.
export const jobApplicationSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(120),
  email: z.string().trim().email('Please enter a valid email address').max(200),
  phone: phoneField(),
  city: optionalTrimmed(80),
  message: optionalTrimmed(2000),
  // Absent on a general application, which is the whole point of the page when
  // nothing is open.
  positionId: optionalTrimmed(40),
  company: z.string().max(0, 'Spam detected').optional().or(z.literal('')),
});

export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

export const jobPositionSchema = z.object({
  id: optionalTrimmed(40),
  title: z.string().trim().min(2, 'A position needs a title').max(120),
  hotelSlug: optionalTrimmed(60),
  department: z.string().trim().min(2, 'Please enter a department').max(80),
  descriptionText: optionalTrimmed(8000),
  open: z.preprocess((val) => val === 'on' || val === 'true' || val === true, z.boolean()),
});

export type JobPositionInput = z.infer<typeof jobPositionSchema>;
