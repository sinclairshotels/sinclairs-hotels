import type { JobApplication } from '@prisma/client';
import { buttonHtml, emailLayout, escapeHtml, fieldRowsHtml } from './layout';

// Sent to HR when somebody applies. The CV is linked rather than attached: the
// blob URL is what the admin list uses too, so there is one copy of the file
// and one place it can be withdrawn from.
export function jobApplicationHtml({
  application,
  cvUrl,
}: {
  application: JobApplication;
  cvUrl: string | null;
}): string {
  const fields: Array<[string, string]> = [
    ['Position', application.positionLabel],
    ['Name', application.name],
    ['Email', application.email],
    ['Phone', application.phone],
    ...(application.city ? ([['City', application.city]] as Array<[string, string]>) : []),
    ...(application.message ? ([['Message', application.message]] as Array<[string, string]>) : []),
    ['CV', application.cvFileName ?? 'Not attached'],
  ];

  const bodyHtml = `
    <p style="font-size:14px; margin:0 0 20px;">A new application came in through the website.</p>
    ${fieldRowsHtml(fields)}
    ${
      cvUrl
        ? `<div style="margin:20px 0;">${buttonHtml(cvUrl, 'Download CV')}</div>`
        : `<p style="font-size:13px; margin:20px 0; color:#404040;">No CV was attached. Reply to this email to ask for one &mdash; it goes straight to ${escapeHtml(
            application.email,
          )}.</p>`
    }
  `;

  return emailLayout({ title: `Application: ${application.positionLabel}`, bodyHtml });
}
