'use server';

import { getHotelBySlug } from '@/content/hotels';
import {
  CareersStorageUnconfigured,
  careersStorageConfigured,
  checkDocument,
  putDocument,
} from '@/lib/careers-storage';
import { prisma } from '@/lib/db';
import { jobApplicationHtml } from '@/lib/email-templates/job-application';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { recipientsFor } from '@/lib/notification-emails';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { jobApplicationSchema } from '@/lib/validation';
import { headers } from 'next/headers';

export type ApplicationState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const TALENT_POOL_LABEL = 'General application';

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const ip = clientIp(await headers());
  if (isRateLimited(`careers:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = jobApplicationSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    city: formData.get('city'),
    message: formData.get('message'),
    positionId: formData.get('positionId'),
    company: formData.get('company'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Same silent fake-success as the enquiry form: a bot is told nothing.
  if (parsed.data.company) {
    log.warn('careers.spam_blocked');
    return { status: 'success', message: 'Thank you — we have your application.' };
  }

  const { name, email, phone, city, message, positionId } = parsed.data;

  // An application against a closed or deleted position is treated as a general
  // one rather than refused: the applicant did nothing wrong, and the label
  // keeps the list honest about what they actually applied to.
  const position = positionId
    ? await prisma.jobPosition.findFirst({ where: { id: positionId, open: true } })
    : null;
  const positionLabel = position
    ? `${position.title}${position.hotelSlug ? ` — ${getHotelBySlug(position.hotelSlug)?.name ?? position.hotelSlug}` : ''}`
    : TALENT_POOL_LABEL;

  const file = formData.get('cv');
  let cv: { url: string; fileName: string; size: number } | null = null;

  if (file instanceof File && file.size > 0) {
    const check = checkDocument({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) {
      return { status: 'error', message: check.message, fieldErrors: { cv: [check.message] } };
    }
    if (!careersStorageConfigured()) {
      log.error('careers.storage_unconfigured');
      return {
        status: 'error',
        message: 'We cannot accept attachments just now. Please try again shortly.',
      };
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await putDocument('cv', bytes, file.name, file.type);
      cv = { url: stored.url, fileName: file.name, size: file.size };
    } catch (error) {
      if (error instanceof CareersStorageUnconfigured) {
        return { status: 'error', message: 'We cannot accept attachments just now.' };
      }
      throw error;
    }
  }

  const application = await prisma.jobApplication.create({
    data: {
      positionId: position?.id ?? null,
      positionLabel,
      name,
      email,
      phone,
      city: city || null,
      message: message || null,
      cvUrl: cv?.url ?? null,
      cvFileName: cv?.fileName ?? null,
      cvSize: cv?.size ?? null,
      userIp: ip,
    },
  });

  // No applicant name, email or CV link in the log line — lib/log.ts redacts
  // those field names anyway, and there is nothing here worth the risk.
  log.info('careers.application_received', {
    application_id: application.id,
    position_id: position?.id ?? null,
    has_cv: cv !== null,
  });

  const hr = await recipientsFor('CAREERS');
  if (hr.to.length > 0) {
    await sendMail({
      ...hr,
      kind: 'job-application',
      replyTo: email,
      subject: `Application: ${positionLabel}`,
      html: jobApplicationHtml({ application, cvUrl: cv?.url ?? null }),
    });
  } else {
    // The application is saved and visible in the admin either way; this only
    // says nobody was told about it, which is a setting somebody has to fix.
    log.warn('careers.no_recipients', { application_id: application.id });
  }

  return {
    status: 'success',
    message: 'Thank you — we have your application and will be in touch if there is a fit.',
  };
}
