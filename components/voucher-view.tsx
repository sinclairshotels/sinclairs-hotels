import { VOUCHER_TERMS_HTML } from '@/content/legal';
import { contactNumbers } from '@/content/site';
import type { Hotel } from '@/content/types';
import { voucherGuestFields } from '@/lib/voucher-view';
import type { Voucher } from '@prisma/client';

export function VoucherView({ voucher, hotel }: { voucher: Voucher; hotel?: Hotel }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="font-display text-2xl text-forest">Booking Voucher</p>
      <p className="mt-1 text-sm text-ink/60">Voucher #{voucher.voucherNo}</p>

      <div className="mt-6 overflow-hidden rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <tbody>
            {voucherGuestFields(voucher, hotel).map(([label, value]) => (
              <tr key={label} className="border-b border-ink/5 last:border-0 odd:bg-cream/50">
                <td className="w-48 px-4 py-2 font-medium text-ink/70">{label}</td>
                <td className="px-4 py-2 whitespace-pre-line">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hotel?.contact && (
        <p className="mt-6 text-sm text-ink/70">
          <strong>{hotel.name}</strong>
          <br />
          {hotel.contact.address}
          <br />
          Reservations: {contactNumbers.tollFree}
        </p>
      )}

      <div
        className="mt-8 text-xs text-ink/70"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: code-owned static legal copy, not user input
        dangerouslySetInnerHTML={{ __html: VOUCHER_TERMS_HTML }}
      />
    </main>
  );
}
