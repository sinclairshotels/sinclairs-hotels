'use server';

import { getHotelBySlug, hotels } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorize, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { EnquiryCloseReason, EnquiryStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

export type EnquiryActionState = { status: 'idle' | 'success' | 'error'; message?: string };

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(200);

// The link in an assignment or forward has to open the admin, which only
// answers on the staff host. Derived from the request rather than from
// SITE_BASE_URL, which points at the public site.
async function staffBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const proto =
    headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function guard(capability: 'enquiries:read', key: string) {
  const auth = await authorize(capability);
  if (!auth.ok) return auth;
  if (isRateLimited(`${key}:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { ok: false as const, message: 'Too many requests. Please try again in a minute.' };
  }
  return auth;
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

export async function assignEnquiry(
  _prev: EnquiryActionState,
  formData: FormData,
): Promise<EnquiryActionState> {
  const auth = await guard('enquiries:read', 'enquiry-assign');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const userId = String(formData.get('userId') ?? '');

  const enquiry = await prisma.enquiry.findUnique({ where: { id }, include: { assignedTo: true } });
  if (!enquiry) return { status: 'error', message: 'That enquiry no longer exists.' };

  const assignee = userId
    ? await prisma.user.findFirst({ where: { id: userId, active: true } })
    : null;
  if (userId && !assignee) return { status: 'error', message: 'That account is not active.' };

  await prisma.enquiry.update({
    where: { id },
    data: { assignedToUserId: assignee?.id ?? null, assignedAt: assignee ? new Date() : null },
  });

  await recordAudit({
    user: auth.user,
    action: assignee ? 'enquiry.assigned' : 'enquiry.unassigned',
    entity: 'Enquiry',
    entityId: id,
    hotelSlug: enquiry.property,
    summary: assignee ? `Assigned to ${assignee.name}` : 'Assignment cleared',
    before: { assignedTo: enquiry.assignedTo?.email ?? null },
    after: { assignedTo: assignee?.email ?? null },
    ip: clientIp(await headers()),
  });

  if (assignee) {
    const url = `${await staffBaseUrl()}/admin/enquiries/${id}`;
    await sendMail({
      to: assignee.email,
      kind: 'enquiry-assigned',
      // Not the guest's address: replying to this should reach the person who
      // assigned it, not the guest, who has not been written to yet.
      replyTo: auth.user.email,
      subject: `Enquiry assigned to you — ${getHotelBySlug(enquiry.property)?.name ?? enquiry.property}`,
      html: assignedHtml({
        assignerName: auth.user.name,
        propertyName: getHotelBySlug(enquiry.property)?.name ?? enquiry.property,
        url,
      }),
    });
  }

  log.info('enquiry.assigned', { enquiry_id: id, assigned: Boolean(assignee) });
  revalidatePath('/admin/enquiries');
  revalidatePath(`/admin/enquiries/${id}`);
  return {
    status: 'success',
    message: assignee ? `Assigned to ${assignee.name}, and emailed.` : 'Assignment cleared.',
  };
}

function assignedHtml({
  assignerName,
  propertyName,
  url,
}: { assignerName: string; propertyName: string; url: string }): string {
  return `
    <p>${escapeHtml(assignerName)} has assigned you an enquiry for ${escapeHtml(propertyName)}.</p>
    <p><a href="${url}">Open the enquiry</a></p>
    <p style="color:#666;font-size:12px">The guest's details are on that page — this email deliberately carries none of them.</p>
  `;
}

// The guest's name, message and contact details stay out of these emails. They
// go to a staff inbox that may be a shared one, and the enquiry itself is one
// click away behind a sign-in.
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

// ---------------------------------------------------------------------------
// Forwarding
// ---------------------------------------------------------------------------

export async function forwardEnquiry(
  _prev: EnquiryActionState,
  formData: FormData,
): Promise<EnquiryActionState> {
  const auth = await guard('enquiries:read', 'enquiry-forward');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const parsed = emailSchema.safeParse(formData.get('address'));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid address.' };
  }

  const enquiry = await prisma.enquiry.findUnique({ where: { id } });
  if (!enquiry) return { status: 'error', message: 'That enquiry no longer exists.' };

  const propertyName = getHotelBySlug(enquiry.property)?.name ?? enquiry.property;
  await sendMail({
    to: parsed.data,
    kind: 'enquiry-forwarded',
    replyTo: enquiry.email,
    subject: `Forwarded enquiry — ${propertyName}`,
    html: `
      <p>${escapeHtml(auth.user.name)} forwarded you an enquiry for ${escapeHtml(propertyName)}.</p>
      <p><strong>From:</strong> ${escapeHtml(enquiry.name)} &lt;${escapeHtml(enquiry.email)}&gt;<br/>
         <strong>Phone:</strong> ${escapeHtml(enquiry.phone)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(enquiry.message)}</p>
    `,
  });

  await recordAudit({
    user: auth.user,
    action: 'enquiry.forwarded',
    entity: 'Enquiry',
    entityId: id,
    hotelSlug: enquiry.property,
    // The address is the point of the record, so it is in the summary as well
    // as the payload — the audit list shows summaries without expanding a row.
    summary: `Forwarded to ${parsed.data}`,
    after: { forwardedTo: parsed.data },
    ip: clientIp(await headers()),
  });

  log.info('enquiry.forwarded', { enquiry_id: id });
  revalidatePath(`/admin/enquiries/${id}`);
  return { status: 'success', message: `Forwarded to ${parsed.data}.` };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const CLOSE_REASON_LABEL: Record<EnquiryCloseReason, string> = {
  BOOKED: 'Booked',
  DECLINED: 'Declined',
  NO_RESPONSE: 'No response',
  SPAM: 'Spam',
};

export async function setEnquiryStatus(
  _prev: EnquiryActionState,
  formData: FormData,
): Promise<EnquiryActionState> {
  const auth = await guard('enquiries:read', 'enquiry-status');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('status') ?? '');
  if (!(next in EnquiryStatus)) return { status: 'error', message: 'Unknown status.' };
  const status = next as EnquiryStatus;

  const rawReason = String(formData.get('closeReason') ?? '');
  const closeReason =
    status === 'CLOSED' && rawReason in EnquiryCloseReason
      ? (rawReason as EnquiryCloseReason)
      : null;

  // Closing without saying why is the thing this screen exists to stop.
  if (status === 'CLOSED' && !closeReason) {
    return { status: 'error', message: 'Choose a reason for closing.' };
  }

  const enquiry = await prisma.enquiry.findUnique({ where: { id } });
  if (!enquiry) return { status: 'error', message: 'That enquiry no longer exists.' };

  await prisma.enquiry.update({
    where: { id },
    data: {
      status,
      closeReason,
      statusChangedAt: new Date(),
      statusChangedLabel: `${auth.user.name} <${auth.user.email}>`,
    },
  });

  const described =
    status === 'CLOSED'
      ? `Closed — ${CLOSE_REASON_LABEL[closeReason as EnquiryCloseReason]}`
      : status === 'CONTACTED'
        ? 'Marked contacted'
        : 'Reopened';

  await recordAudit({
    user: auth.user,
    action: 'enquiry.status_changed',
    entity: 'Enquiry',
    entityId: id,
    hotelSlug: enquiry.property,
    summary: described,
    before: { status: enquiry.status, closeReason: enquiry.closeReason },
    after: { status, closeReason },
    ip: clientIp(await headers()),
  });

  log.info('enquiry.status_changed', { enquiry_id: id, status, close_reason: closeReason });
  revalidatePath('/admin/enquiries');
  revalidatePath(`/admin/enquiries/${id}`);
  return { status: 'success', message: `${described}.` };
}

// Append-only. There is no edit and no delete: an entry records what somebody
// did at a time, and letting a later hand rewrite it would make the thread a
// worse account of the conversation than the mailbox it exists to save opening.
export async function addEnquiryNote(
  _prev: EnquiryActionState,
  formData: FormData,
): Promise<EnquiryActionState> {
  const auth = await guard('enquiries:read', 'enquiry-note');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const body = String(formData.get('body') ?? '')
    .trim()
    .slice(0, 2000);

  if (!body) return { status: 'error', message: 'Write something first.' };

  const enquiry = await prisma.enquiry.findUnique({ where: { id } });
  if (!enquiry) return { status: 'error', message: 'That enquiry no longer exists.' };

  const note = await prisma.enquiryNote.create({
    data: {
      enquiryId: id,
      body,
      authorUserId: auth.user.id,
      authorLabel: `${auth.user.name} <${auth.user.email}>`,
    },
  });

  await recordAudit({
    user: auth.user,
    action: 'enquiry.note_added',
    entity: 'Enquiry',
    entityId: id,
    hotelSlug: enquiry.property,
    // The note itself is on the enquiry; the audit line records that one was
    // added, without copying guest correspondence into a second place.
    summary: 'Note added',
    after: { noteId: note.id },
    ip: clientIp(await headers()),
  });

  revalidatePath(`/admin/enquiries/${id}`);
  return { status: 'success', message: 'Added.' };
}
