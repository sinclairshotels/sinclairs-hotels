'use server';

import { prisma } from '@/lib/db';
import { enquiryNotificationHtml } from '@/lib/email-templates/enquiry-notification';
import { log } from '@/lib/log';
import { STAFF_NOTIFY_EMAIL, sendMail } from '@/lib/mail';
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
};

const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  HOTEL: 'Hotel Booking',
  WEDDING: 'Wedding',
  MEETINGS: 'Meetings & Events',
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

  const { name, email, phone, property, type, checkIn, checkOut, guests, message } = parsed.data;
  const typeLabel = ENQUIRY_TYPE_LABELS[type] ?? type;

  const enquiry = await prisma.enquiry.create({
    data: {
      name,
      email,
      phone,
      property,
      type,
      message,
      guests: guests ?? null,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      userIp: ip,
    },
  });

  // The lead is already committed at this point, so this is the line that says
  // a generate_lead in GA4 should exist for this submission.
  log.info('enquiry.created', { enquiry_id: enquiry.id, property, type, guests: guests ?? null });

  await sendMail({
    to: STAFF_NOTIFY_EMAIL,
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
  };
}
