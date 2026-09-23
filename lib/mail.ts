import { errorFields, log } from '@/lib/log';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// sinclairshotels.com isn't verified in Resend yet (the domain still points at the
// legacy site — see CLAUDE.md's SEO note), so sending "from" it 403s with
// "domain is not verified" and Resend never delivers. Resend's own onboarding@resend.dev
// sender needs no domain verification, at the cost of only being able to deliver to the
// Resend account's own verified email — fine for pre-launch testing. Swap
// MAIL_FROM_ADDRESS to a sinclairshotels.com address once that domain is added and
// verified at https://resend.com/domains.
const FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || 'Sinclairs Hotels <onboarding@resend.dev>';

// Configurable so a local/staging environment can redirect staff notifications to a
// safe test inbox via env var, without touching the three call sites that use it.
export const STAFF_NOTIFY_EMAIL =
  process.env.STAFF_NOTIFY_EMAIL || 'reservations@sinclairshotels.com';

// The booking office that receives a copy of every voucher. Agreed with the
// business on 2026-09-12; kept in env rather than inlined at the call site so it
// can be changed without a deploy. Distinct from the public reservations@
// address on the contact page and in the footer, which is what guests write to.
export const VOUCHER_OFFICE_EMAIL =
  process.env.VOUCHER_OFFICE_EMAIL || 'kolkata@sinclairshotels.com';

// Every outbound mail is also Bcc'd here. Originally a testing aid; the business
// has since asked for a permanent archive copy of all correspondence, which is
// the same mechanism. Blank by default so a fresh environment Bccs nobody.
const OWNER_BCC_EMAIL = process.env.OWNER_BCC_EMAIL || undefined;

// Pre-launch safety valve: real guest/hotel addresses typed into the Voucher and
// Enquiry forms would otherwise be emailed for real. When set, every outbound
// mail is redirected here instead — the original recipient(s) are kept in the
// subject line so nothing about what *would* have sent is lost. Unset once the
// team is ready for vouchers/enquiries to reach real guests and hotels.
const RECIPIENT_OVERRIDE = process.env.MAIL_RECIPIENT_OVERRIDE || undefined;

function withOwnerBcc(bcc?: string | string[]): string | string[] | undefined {
  if (!OWNER_BCC_EMAIL) return bcc;
  const existing = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];
  return existing.includes(OWNER_BCC_EMAIL) ? existing : [...existing, OWNER_BCC_EMAIL];
}

export async function sendMail({
  to,
  cc,
  bcc,
  replyTo,
  subject,
  html,
  kind,
}: {
  to: string | string[];
  // Copied openly, as staff configure on the admin page that sends this mail.
  // Suppressed with the recipient override for the same reason `to` is: a test
  // environment must not reach a real inbox by way of a CC.
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html: string;
  // Names the template for the log line, so delivery is traceable without
  // putting the subject (and the guest name inside it) into retained logs.
  kind?: string;
}): Promise<void> {
  const finalTo = RECIPIENT_OVERRIDE ?? to;
  const finalCc = RECIPIENT_OVERRIDE ? undefined : cc;
  const finalBcc = RECIPIENT_OVERRIDE ? undefined : withOwnerBcc(bcc);
  const finalSubject = RECIPIENT_OVERRIDE
    ? `[TEST → ${Array.isArray(to) ? to.join(', ') : to}] ${subject}`
    : subject;

  if (!resend) {
    // Reached in production too if RESEND_API_KEY is ever unset, so this is a
    // warn rather than a dev-only debug line: staff notifications are silently
    // not being sent, which looks identical to nobody enquiring.
    log.warn('mail.skipped_no_provider', {
      kind,
      recipients: Array.isArray(finalTo) ? finalTo.length : 1,
      recipient_override: RECIPIENT_OVERRIDE !== undefined,
    });
    return;
  }

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: finalTo,
    cc: finalCc,
    bcc: finalBcc,
    replyTo,
    subject: finalSubject,
    html,
  });
  if (error) {
    log.error('mail.send_failed', { kind, ...errorFields(error) });
  } else {
    // Resend accepting the request (an id back, no error) isn't the same as
    // the email actually landing — an id here with no inbox delivery points
    // at a Resend-side/recipient-side issue (e.g. the onboarding@resend.dev
    // sandbox sender's real-recipient restriction), not a bug in this code.
    log.info('mail.sent', { kind, message_id: data?.id ?? null });
  }
}
