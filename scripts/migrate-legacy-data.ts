// One-time import of legacy MySQL data (enquiry, voucher_detail,
// newsletter_signup, cca_status) from the old GoDaddy-hosted PHP site into
// this app's Postgres. Not part of the running app — run once via
// `pnpm tsx scripts/migrate-legacy-data.ts`, then it can be deleted or kept
// for reference. Safe to re-run: every insert target has a real unique
// constraint (voucherNo, legacyId, legacyTicket, email, orderId) so
// createMany with skipDuplicates just skips rows already imported.
//
// Three separate legacy MySQL databases feed this: sinclairsltd_official
// (enquiry, newsletter_signup), sinclairsltd_voucher (voucher_detail), and
// sinclairsltd_hdfcmpgs (cca_status — the CCAvenue/HDFC gateway transaction
// log, missed in the first migration pass and added later).
//
// Reads mysqldump files from ~/Desktop/sinclairs-wp-backup/legacy-php-site/dumps/
// (gitignored, outside the repo — never committed). The legacy schema is looser
// than ours (free-text "varchar" columns for dates/amounts/room counts), so a lot
// of this file is about not silently dropping real guest/enquiry data when a value
// doesn't parse cleanly: unparseable numeric/date fragments are defaulted and the
// original text is preserved in a free-text note field instead of being discarded.

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  EnquiryStatus,
  EnquiryType,
  PaymentStatus,
  type Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const DUMPS_DIR = join(homedir(), 'Desktop/sinclairs-wp-backup/legacy-php-site/dumps');
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// mysqldump parsing — hand-rolled rather than pulling in a SQL parser dependency
// for a script that runs exactly once. Handles the one thing that matters here:
// extended-insert multi-row VALUES tuples with quoted/escaped string fields.
// ---------------------------------------------------------------------------

function parseInsertRows(sql: string, table: string): string[][] {
  const insertRe = new RegExp(`INSERT INTO \`${table}\`.*?VALUES\\s*([\\s\\S]*?);\\n`, 'g');
  const rows: string[][] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-in-loop pattern
  while ((m = insertRe.exec(sql))) {
    const blob = m[1] ?? '';
    let depth = 0;
    let inStr = false;
    let tuple = '';
    for (let i = 0; i < blob.length; i++) {
      const c = blob.charAt(i);
      if (inStr) {
        if (c === '\\') {
          tuple += c + blob.charAt(i + 1);
          i++;
          continue;
        }
        if (c === "'") inStr = false;
        tuple += c;
      } else if (c === "'") {
        inStr = true;
        tuple += c;
      } else if (c === '(') {
        depth++;
        tuple += c;
      } else if (c === ')') {
        depth--;
        tuple += c;
        if (depth === 0) {
          rows.push(splitFields(tuple));
          tuple = '';
        }
      } else if (depth > 0) {
        tuple += c;
      }
      // else: outside any tuple at depth 0 — discard (the "," separator between
      // tuples, and occasional bare whitespace/newlines mysqldump inserts there).
      // Discarding unconditionally (not just for ",") matters: MariaDB's dump
      // sometimes puts a literal newline between tuples, and appending it here
      // would prepend a stray char onto the next tuple, throwing off
      // splitFields's tuple.slice(1, -1) (which assumes tuple[0] is exactly "(").
    }
  }
  return rows;
}

function splitFields(tuple: string): string[] {
  const inner = tuple.slice(1, -1);
  const fields: string[] = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inStr) {
      if (c === '\\') {
        cur += c + inner[i + 1];
        i++;
        continue;
      }
      if (c === "'") inStr = false;
      cur += c;
    } else {
      if (c === "'") {
        inStr = true;
        cur += c;
      } else if (c === ',') {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  fields.push(cur.trim());
  return fields;
}

// Best-effort fix for the legacy DB's UTF-8-stored-as-Latin1 mojibake (e.g. an
// en-dash surviving as "Ã¢â¬â"). Reverts if the round-trip produces invalid UTF-8
// (U+FFFD) — i.e. the text was genuinely Latin-1, not double-encoded UTF-8.
function fixMojibake(s: string): string {
  const attempt = Buffer.from(s, 'latin1').toString('utf8');
  return attempt.includes('�') ? s : attempt;
}

function unq(raw: string | undefined): string | null {
  if (raw === undefined || raw === 'NULL') return null;
  if (raw.startsWith("'") && raw.endsWith("'")) {
    const s = raw
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
    const fixed = fixMojibake(s).trim();
    return fixed === '' ? null : fixed;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Value parsing helpers — the legacy columns are free-text varchars even where
// the new schema expects a number/date, so every one of these can fail; callers
// decide whether a failure means "default + preserve raw text" or "skip row".
// ---------------------------------------------------------------------------

function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : null;
}

function parseLeadingInt(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^\d+/);
  return m ? Number.parseInt(m[0], 10) : null;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The legacy PHP app ran with date_default_timezone_set('Asia/Kolkata'), so
// every stored datetime string is IST wall-clock time with no offset marker.
// Parsed via plain `new Date(str)`, a bare "YYYY-MM-DD HH:MM:SS" is interpreted
// as *local time of whatever machine runs this script* — correct by accident on
// a Kolkata-timezone machine, silently off by 5:30 anywhere else (e.g. Vercel's
// UTC runtime). Parse the components explicitly instead so the result doesn't
// depend on the host's timezone.
function parseISODateTime(raw: string | null): Date | null {
  if (!raw || raw.startsWith('0000-00-00')) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, da, h, mi, s] = m;
  const utcMs = Date.UTC(
    Number.parseInt(y ?? '', 10),
    Number.parseInt(mo ?? '', 10) - 1,
    Number.parseInt(da ?? '', 10),
    Number.parseInt(h ?? '', 10),
    Number.parseInt(mi ?? '', 10),
    Number.parseInt(s ?? '', 10),
  );
  const d = new Date(utcMs - IST_OFFSET_MS);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Handles the legacy D-M-YYYY / DD-MM-YYYY / DD.MM.YY / DD/MM/YYYY family used
// in arrival/departure/check_in/check_out/dates — not anchored at the end since
// some rows append trailing free text after the date (e.g. "1-1-2026 (2 nights)").
// Returns null (not throw) on anything else — callers log-and-skip or
// log-and-default as appropriate.
function parseDMY(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2,4})/);
  if (!m) return null;
  const day = Number.parseInt(m[1] ?? '', 10);
  const month = Number.parseInt(m[2] ?? '', 10);
  let year = Number.parseInt(m[3] ?? '', 10);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) || d.getUTCMonth() !== month - 1 ? null : d;
}

// cca_status's trans_date is mostly "DD/MM/YYYY HH:MM:SS" IST wall-clock (same
// double-encoding concern as parseISODateTime — converted explicitly rather
// than trusting the host's timezone), but a handful of later rows use
// "YYYY-MM-DD HH:MM:SS[.ms]" instead (falls back to parseISODateTime). Its
// time_stamp column is NOT the real transaction time (it's an
// `ON UPDATE current_timestamp()` column that's identical across unrelated
// rows in samples, i.e. a batch-touch marker) — trans_date is the only
// trustworthy timestamp in this table.
function parseTransDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) return parseISODateTime(raw);
  const [, d, mo, y, h, mi, s] = m;
  const utcMs = Date.UTC(
    Number.parseInt(y ?? '', 10),
    Number.parseInt(mo ?? '', 10) - 1,
    Number.parseInt(d ?? '', 10),
    Number.parseInt(h ?? '', 10),
    Number.parseInt(mi ?? '', 10),
    Number.parseInt(s ?? '', 10),
  );
  const date = new Date(utcMs - IST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : date;
}

// check_in/check_out/dates can hold multiple dates for one legacy voucher row
// (several room-date combinations), separated inconsistently by "," or ";".
// Returns the earliest and latest parseable date across all tokens.
function parseDateRange(raw: string | null): { earliest: Date | null; latest: Date | null } {
  if (!raw) return { earliest: null, latest: null };
  const dates = raw
    .split(/[,;]/)
    .map((s) => parseDMY(s.trim()))
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return { earliest: null, latest: null };
  return {
    earliest: new Date(Math.min(...dates.map((d) => d.getTime()))),
    latest: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

function joinNotes(parts: (string | null)[]): string | null {
  const nonEmpty = parts.filter((p): p is string => !!p && p.trim() !== '');
  return nonEmpty.length === 0 ? null : nonEmpty.join('\n');
}

// ---------------------------------------------------------------------------
// Hotel name → current slug mapping. Legacy hotel_id/location is free-text and
// has 13 distinct historical values for the 9 current properties, including two
// known variants that fold into one slug. "Sinclairs Yangang" is a deliberate
// exception — kept verbatim (not folded into gangtok, not slugified) per an
// explicit decision to review it separately rather than guess.
// ---------------------------------------------------------------------------

const HOTEL_MAP: Record<string, string> = {
  'sinclairs retreat ooty': 'ooty',
  'sinclairs bayview port blair': 'port-blair',
  'sinclairs darjeeling': 'darjeeling',
  'sinclairs retreat kalimpong': 'kalimpong',
  'sinclairs retreat dooars': 'dooars',
  'sinclairs gangtok': 'gangtok',
  'sinclairs retreat gangtok': 'gangtok',
  'sinclairs siliguri': 'siliguri',
  'sinclairs burdwan': 'burdwan',
  'sinclairs udaipur': 'udaipur',
  'sinclairs palace retreat udaipur': 'udaipur',
  'sinclairs yangang': 'Sinclairs Yangang',
};

function mapHotel(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return HOTEL_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

type Report = {
  table: string;
  totalRows: number;
  inserted: number;
  skippedByReason: Record<string, number>;
  skippedSamples: Record<string, string[]>;
};

function newReport(table: string): Report {
  return { table, totalRows: 0, inserted: 0, skippedByReason: {}, skippedSamples: {} };
}

function skip(report: Report, reason: string, sample: string) {
  report.skippedByReason[reason] = (report.skippedByReason[reason] ?? 0) + 1;
  const existing = report.skippedSamples[reason];
  if (existing) {
    if (existing.length < 5) existing.push(sample);
  } else {
    report.skippedSamples[reason] = [sample];
  }
}

// ---------------------------------------------------------------------------
// Enquiry
// ---------------------------------------------------------------------------

const ENQUIRY_COLS = [
  'enquiry_id',
  'subject',
  'ticket',
  'location',
  'room',
  'no_of_rooms',
  'arrival',
  'departure',
  'child',
  'adult',
  'name',
  'email',
  'phone',
  'query',
  'enquiry_time',
  'user_ip',
  'ex_link',
  'delete_status',
  'persons',
] as const;

function inferEnquiryType(subject: string): EnquiryType {
  const s = subject.toLowerCase();
  if (s.includes('wedding')) return EnquiryType.WEDDING;
  if (s.includes('conference') || s.includes('meeting')) return EnquiryType.MEETINGS;
  return EnquiryType.HOTEL;
}

async function migrateEnquiry(): Promise<Report> {
  const report = newReport('Enquiry');
  const sql = readFileSync(join(DUMPS_DIR, 'enquiry.sql'), 'latin1');
  const rows = parseInsertRows(sql, 'enquiry');
  report.totalRows = rows.length;

  const data: Prisma.EnquiryCreateManyInput[] = [];

  for (const fields of rows) {
    const get = (name: (typeof ENQUIRY_COLS)[number]) => unq(fields[ENQUIRY_COLS.indexOf(name)]);
    const raw = fields.join(',');

    if (get('delete_status') === 'y') {
      skip(report, 'soft-deleted in legacy (delete_status=y)', raw.slice(0, 120));
      continue;
    }
    const property = mapHotel(get('location'));
    if (!property) {
      skip(report, `unmapped property: "${get('location')}"`, raw.slice(0, 120));
      continue;
    }
    const email = get('email');
    if (!email) {
      skip(report, 'missing email', raw.slice(0, 120));
      continue;
    }
    // A handful of legacy rows have an empty (not just missing) ticket, which
    // unq() normalizes to null — and Postgres unique constraints don't dedupe
    // multiple NULLs, so those specific rows would re-insert on every re-run.
    // Fall back to a synthetic ticket keyed on the legacy row's own id, which
    // is stable across runs.
    const ticket = get('ticket') ?? `LEGACY-${get('enquiry_id')}`;
    const createdAt = parseISODateTime(get('enquiry_time')) ?? new Date();
    const child = Number.parseInt(get('child') ?? '', 10);
    const adult = Number.parseInt(get('adult') ?? '', 10);
    const guests = [child, adult].some(Number.isNaN) ? null : child + adult;

    const message = joinNotes([
      get('query'),
      '[Legacy enquiry details]',
      `Subject: ${get('subject') ?? ''}`,
      get('room')
        ? `Room: ${get('room')}${get('no_of_rooms') ? ` (x${get('no_of_rooms')})` : ''}`
        : null,
      get('persons') ? `Persons/City (legacy free text): ${get('persons')}` : null,
      get('ex_link') ? `Source: ${get('ex_link')}` : null,
    ]) as string;

    data.push({
      name: get('name') ?? 'Guest',
      email,
      phone: get('phone') ?? '',
      property,
      type: inferEnquiryType(get('subject') ?? ''),
      checkIn: parseDMY(get('arrival') ?? ''),
      checkOut: parseDMY(get('departure') ?? ''),
      guests,
      message,
      status: EnquiryStatus.CLOSED,
      userIp: get('user_ip'),
      legacyTicket: ticket,
      createdAt,
    });
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { count } = await prisma.enquiry.createMany({ data: batch, skipDuplicates: true });
    report.inserted += count;
  }
  return report;
}

// ---------------------------------------------------------------------------
// Voucher
// ---------------------------------------------------------------------------

const VOUCHER_COLS = [
  'id',
  'voucher_making_date',
  'hotel_id',
  'guest_name',
  'address',
  'phone',
  'email',
  'agent',
  'arrival_detail',
  'no_rooms',
  'plan',
  'check_in',
  'check_out',
  'rates',
  'taxes',
  'remarks',
  'advance_receipt',
  'dates',
  'amount',
  'billing_instruction',
  'booking_office',
  'signature',
  'voucherno',
  'h_address',
  'h_telephone',
  'issueofficer',
  'ta',
  'tds',
  'special_ins',
  'date',
  'month',
  'year',
  'randomno',
  'panno',
  'gstin',
  'state',
  'userid',
] as const;

function parsePercent(raw: string | null): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === 'nil' || s === 'na' || s === 'n/a') return 0;
  const m = s.match(/^(\d+(\.\d+)?)\s*%?$/);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? '');
  return n <= 100 ? n : null;
}

async function migrateVoucher(): Promise<Report> {
  const report = newReport('Voucher');
  const sql = readFileSync(join(DUMPS_DIR, 'voucher_detail.sql'), 'latin1');
  const rows = parseInsertRows(sql, 'voucher_detail');
  report.totalRows = rows.length;

  const data: Prisma.VoucherCreateManyInput[] = [];

  for (const fields of rows) {
    const get = (name: (typeof VOUCHER_COLS)[number]) => unq(fields[VOUCHER_COLS.indexOf(name)]);
    const raw = fields.join(',');

    const voucherNo = parseLeadingInt(get('voucherno'));
    if (voucherNo === null) {
      skip(report, `unparseable voucherno: "${get('voucherno')}"`, raw.slice(0, 120));
      continue;
    }
    const hotelSlug = mapHotel(get('hotel_id'));
    if (!hotelSlug) {
      skip(report, `unmapped hotel: "${get('hotel_id')}"`, raw.slice(0, 120));
      continue;
    }
    const { earliest: checkIn } = parseDateRange(get('check_in'));
    const { latest: checkOut } = parseDateRange(get('check_out'));
    if (!checkIn || !checkOut) {
      skip(report, 'unparseable check_in/check_out', raw.slice(0, 160));
      continue;
    }

    const rawRates = get('rates');
    const rate = parseMoney(rawRates) ?? 0;
    const rateUnparsed = parseMoney(rawRates) === null;

    const rawTaxes = get('taxes');
    const taxes = parseMoney(rawTaxes) ?? 0;
    const taxesUnparsed = parseMoney(rawTaxes) === null;

    const noRooms = get('no_rooms');
    const rooms = parseLeadingInt(noRooms) ?? 1;
    const roomsIsBareNumber = noRooms !== null && /^\d+$/.test(noRooms.trim());

    const commissionPct = parsePercent(get('ta'));
    const tdsPct = parsePercent(get('tds'));
    const { earliest: depositDate } = parseDateRange(get('dates'));

    const createdAt =
      parseISODateTime(get('voucher_making_date')) ??
      parseDMY(
        get('date') && get('month') && get('year')
          ? `${get('date')}-${get('month')}-${get('year')}`
          : '',
      ) ??
      checkIn;

    const arrivalDetails = joinNotes([
      get('arrival_detail'),
      !roomsIsBareNumber && noRooms ? `Room details (legacy): ${noRooms}` : null,
    ]);

    const billingInstructions = joinNotes([
      get('billing_instruction'),
      get('plan') ? `Meal plan (legacy): ${get('plan')}` : null,
      get('remarks') ? `Remarks (legacy): ${get('remarks')}` : null,
      taxesUnparsed && rawTaxes ? `Tax note (legacy, raw "taxes" field): ${rawTaxes}` : null,
      rateUnparsed && rawRates ? `Rate note (legacy, raw "rates" field): ${rawRates}` : null,
      get('amount') ? `Amount breakdown (legacy): ${get('amount')}` : null,
      get('dates') ? `Deposit date(s) (legacy, raw): ${get('dates')}` : null,
      commissionPct === null && get('ta') ? `Commission (legacy, raw): ${get('ta')}` : null,
      tdsPct === null && get('tds') ? `TDS (legacy, raw): ${get('tds')}` : null,
      get('h_address') || get('h_telephone')
        ? `Hotel print info at time of voucher (legacy): ${get('h_address') ?? ''} ${get('h_telephone') ?? ''}`.trim()
        : null,
    ]);

    data.push({
      voucherNo,
      viewToken: randomBytes(32).toString('hex'),
      hotelSlug,
      guestName: get('guest_name') ?? '',
      guestPhone: get('phone') ?? '',
      guestEmail: get('email') ?? '',
      billingAddress: get('address') ?? '',
      travelAgentName: get('agent'),
      travelAgentPan: get('panno'),
      travelAgentGstin: get('gstin'),
      travelAgentState: get('state'),
      commissionPct,
      tdsPct,
      rooms,
      checkIn,
      checkOut,
      rate,
      taxes,
      depositAmount: null,
      depositReceiptNo: get('advance_receipt'),
      depositReceiptDate: depositDate,
      billingInstructions,
      arrivalDetails,
      otherServices: null,
      specialInstructions: get('special_ins'),
      issuerName: get('signature') ?? '',
      issuerPhone: get('issueofficer') ?? '',
      bookingOffice: get('booking_office') ?? '',
      legacyId: Number.parseInt(get('id') ?? '', 10),
      createdAt,
    });
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { count } = await prisma.voucher.createMany({ data: batch, skipDuplicates: true });
    report.inserted += count;
  }
  return report;
}

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

const NEWSLETTER_COLS = [
  'id',
  'email_id',
  'subscriber_ip',
  'date_subscribe',
  'status',
  'date_unsubscribe',
] as const;

async function migrateNewsletter(): Promise<Report> {
  const report = newReport('Newsletter');
  const sql = readFileSync(join(DUMPS_DIR, 'newsletter_signup.sql'), 'latin1');
  const rows = parseInsertRows(sql, 'newsletter_signup');
  report.totalRows = rows.length;

  type Row = { email: string; ip: string | null; subscribedAt: Date; unsubscribedAt: Date | null };
  const byEmail = new Map<string, Row>();

  for (const fields of rows) {
    const get = (name: (typeof NEWSLETTER_COLS)[number]) =>
      unq(fields[NEWSLETTER_COLS.indexOf(name)]);
    const raw = fields.join(',');
    const emailRaw = get('email_id');
    if (!emailRaw) {
      skip(report, 'missing email', raw.slice(0, 120));
      continue;
    }
    const email = emailRaw.trim().toLowerCase();
    const subscribedAt = parseISODateTime(get('date_subscribe')) ?? new Date();
    const unsubscribedAt = parseISODateTime(get('date_unsubscribe'));

    const existing = byEmail.get(email);
    if (!existing || subscribedAt < existing.subscribedAt) {
      byEmail.set(email, {
        email,
        ip: get('subscriber_ip'),
        subscribedAt,
        unsubscribedAt: unsubscribedAt ?? existing?.unsubscribedAt ?? null,
      });
    } else if (unsubscribedAt && !existing.unsubscribedAt) {
      existing.unsubscribedAt = unsubscribedAt;
    }
  }

  const data = [...byEmail.values()];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { count } = await prisma.newsletter.createMany({ data: batch, skipDuplicates: true });
    report.inserted += count;
  }
  return report;
}

// ---------------------------------------------------------------------------
// Payment (legacy cca_status — CCAvenue/HDFC gateway transaction log, a third
// legacy MySQL database, sinclairsltd_hdfcmpgs, missed in the first pass)
// ---------------------------------------------------------------------------

const CCA_STATUS_COLS = [
  'dbid',
  'order_id',
  'order_status',
  'tracking_id',
  'bank_ref_no',
  'failure_message',
  'amount',
  'billing_name',
  'billing_email',
  'trans_date',
  'hotel',
  'time_stamp',
] as const;

// Legacy statuses don't map 1:1 onto the current 4-value enum — TIMEOUT/INVALID
// collapse into FAILURE and AWAITED into INITIATED, with the original legacy
// label preserved in failureMessage so nothing is silently reclassified away.
const CCA_STATUS_MAP: Record<string, PaymentStatus> = {
  success: PaymentStatus.SUCCESS,
  failure: PaymentStatus.FAILURE,
  aborted: PaymentStatus.ABORTED,
  initiated: PaymentStatus.INITIATED,
  timeout: PaymentStatus.FAILURE,
  invalid: PaymentStatus.FAILURE,
  awaited: PaymentStatus.INITIATED,
};

async function migratePayment(): Promise<Report> {
  const report = newReport('Payment');
  const sql = readFileSync(join(DUMPS_DIR, 'cca_status.sql'), 'latin1');
  const rows = parseInsertRows(sql, 'cca_status');
  report.totalRows = rows.length;

  const data: Prisma.PaymentCreateManyInput[] = [];

  for (const fields of rows) {
    const get = (name: (typeof CCA_STATUS_COLS)[number]) =>
      unq(fields[CCA_STATUS_COLS.indexOf(name)]);
    const raw = fields.join(',');

    const orderId = get('order_id');
    if (!orderId) {
      skip(report, 'missing order_id', raw.slice(0, 120));
      continue;
    }
    const hotelSlug = mapHotel(get('hotel'));
    if (!hotelSlug) {
      skip(report, `unmapped hotel: "${get('hotel')}"`, raw.slice(0, 120));
      continue;
    }
    const createdAt = parseTransDate(get('trans_date'));
    if (!createdAt) {
      skip(report, `unparseable trans_date: "${get('trans_date')}"`, raw.slice(0, 160));
      continue;
    }

    const legacyStatus = get('order_status')?.trim().toLowerCase() ?? '';
    const status = CCA_STATUS_MAP[legacyStatus];
    if (!status) {
      skip(report, `unmapped order_status: "${get('order_status')}"`, raw.slice(0, 120));
      continue;
    }

    const failureMessage = joinNotes([
      get('failure_message'),
      ['timeout', 'invalid', 'awaited'].includes(legacyStatus)
        ? `Legacy status (legacy): ${get('order_status')}`
        : null,
    ]);

    data.push({
      orderId,
      // An imported transaction still has a receipt page, and that page is
      // addressed by the token — without one, staff opening a CCAvenue-era
      // payment from /admin/payments would get "we couldn't find that".
      viewToken: randomBytes(32).toString('base64url'),
      hotelSlug,
      amount: parseMoney(get('amount')) ?? 0,
      guestName: get('billing_name') ?? '',
      guestEmail: get('billing_email') ?? '',
      guestPhone: '',
      status,
      trackingId: get('tracking_id'),
      bankRefNo: get('bank_ref_no'),
      failureMessage,
      // Blocks the admin Refund button on these: they were taken by the old
      // gateway, so ICICI has no such transaction to reverse. The migration
      // that added this column backfilled the rows imported before it existed.
      legacySource: 'cca_status',
      createdAt,
      updatedAt: createdAt,
    });
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { count } = await prisma.payment.createMany({ data: batch, skipDuplicates: true });
    report.inserted += count;
  }
  return report;
}

// ---------------------------------------------------------------------------

// Voucher.voucherNo is `@default(autoincrement())`, but this import writes the
// legacy numbers explicitly — and an explicit value does not advance Postgres's
// sequence. Left alone the counter stays at 0 while the imported rows occupy
// 21455-35001, so the first voucher issued after an import is #1: it breaks the
// continuity of the business's voucher series immediately, and collides with a
// real imported number once it counts that far up.
async function syncVoucherSequence(): Promise<void> {
  const [row] = await prisma.$queryRaw<{ sequence_now: bigint }[]>`
    SELECT setval('"Voucher_voucherNo_seq"', (SELECT COALESCE(max("voucherNo"), 1) FROM "Voucher")) AS sequence_now
  `;
  console.log(`\nVoucher sequence advanced to ${row?.sequence_now ?? 'unknown'}`);
}

async function main() {
  const reports = [
    await migrateEnquiry(),
    await migrateVoucher(),
    await migrateNewsletter(),
    await migratePayment(),
  ];

  await syncVoucherSequence();

  for (const r of reports) {
    console.log(`\n=== ${r.table} ===`);
    console.log(`  rows in dump: ${r.totalRows}`);
    console.log(`  inserted:     ${r.inserted}`);
    const skippedTotal = Object.values(r.skippedByReason).reduce((a, b) => a + b, 0);
    console.log(`  skipped:      ${skippedTotal}`);
    for (const [reason, count] of Object.entries(r.skippedByReason)) {
      console.log(`    - ${reason}: ${count}`);
    }
  }

  const reportPath = join(DUMPS_DIR, 'migration-report.json');
  writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\nFull report (with skip samples) written to ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
