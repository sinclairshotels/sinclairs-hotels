'use server';

import { enquiryReference } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { enquiryNotificationHtml } from '@/lib/email-templates/enquiry-notification';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { guaranteedRecipients } from '@/lib/notification-emails';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { enquirySchema } from '@/lib/validation';
import { headers } from 'next/headers';

export type EnquiryFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  // Distinguishes a real submission from the honeypot's silent fake-success
  // reply, so the client only fires an analytics conversion on a real lead.
  leadCaptured?: boolean;
  // Shown on the thank-you screen so the guest has something to quote. Absent
  // on the honeypot's fake success, which must not mint a reference for a
  // record that was never written.
  reference?: string;
};

const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  HOTEL: 'Rooms',
  WEDDING: 'Wedding',
  MEETINGS: 'Meetings & Events',
  GROUP: 'Group Stay',
};

export async function submitEnquiry(
  _prevState: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(ip)) {
    log.warn('enquiry.rate_limited');
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = enquirySchema.safeParse(raw);

  if (!parsed.success) {
    log.warn('enquiry.invalid', {
      fields: Object.keys(parsed.error.flatten().fieldErrors).join(','),
    });
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (parsed.data.company) {
    log.warn('enquiry.spam_blocked', { property: parsed.data.property, type: parsed.data.type });
    return { status: 'success' };
  }

  const {
    name,
    email,
    phone,
    property,
    type,
    checkIn,
    checkOut,
    guests,
    message,
    city,
    pinCode,
    replyChannel,
    flexibility,
    roomsNeeded,
  } = parsed.data;
  const typeLabel = ENQUIRY_TYPE_LABELS[type] ?? type;

  const enquiry = await prisma.enquiry.create({
    data: {
      name,
      email,
      phone,
      property,
      type,
      message,
      reference: enquiryReference(),
      guests: guests ?? null,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      city: city || null,
      pinCode: pinCode || null,
      replyChannel,
      flexibility: flexibility || null,
      roomsNeeded: roomsNeeded ?? null,
      userIp: ip,
    },
  });

  // The lead is already committed at this point, so this is the line that says
  // a generate_lead in GA4 should exist for this submission.
  log.info('enquiry.created', { enquiry_id: enquiry.id, property, type, guests: guests ?? null });

  await sendMail({
    ...(await guaranteedRecipients('ENQUIRY', property)),
    kind: 'enquiry-notification',
    replyTo: email,
    subject: `New ${typeLabel} enquiry — ${property} (${name})`,
    html: enquiryNotificationHtml({
      name,
      email,
      phone,
      property,
      type: typeLabel,
      checkIn,
      checkOut,
      guests,
      message,
    }),
  });

  return {
    status: 'success',
    message: 'Thank you — our team will be in touch shortly.',
    leadCaptured: true,
    reference: enquiry.reference ?? undefined,
  };
}
