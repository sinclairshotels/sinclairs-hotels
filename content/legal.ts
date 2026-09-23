// Ported from the legacy site's Voucher/rulestnc.php — real business/legal
// copy, not placeholder text. One section is no longer verbatim: the
// cancellation policy was rewritten on 23 Sep 2026 to match the refundable /
// non-refundable model the booking engine actually sells (see PLAN.md's
// decisions log). The graduated 10/50/100% tiers it replaced described a
// policy nothing in this app could enforce, and contradicted what the
// confirmation told the same guest.
//
// This block is printed on every voucher and served at /terms, so it and
// lib/cancellation.ts have to agree. Change both together.
export const VOUCHER_TERMS_HTML = `
<div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#404040; line-height:18px;">
  <p style="background-color:#f2f2f2; border-top:1px solid #069FDB; border-bottom:1px solid #069FDB; padding:6px 8px; color:#c0392b; font-weight:bold; margin:0 0 16px;">
    IMPORTANT &mdash; GST Credit: In case you wish to avail of Input Credit, please mention your GSTIN details clearly. Tax invoice against this voucher cannot be changed once issued.
  </p>

  <p style="font-size:13px; font-weight:bold; margin:0 0 8px;">Terms and Conditions</p>
  <ul style="margin:0 0 16px; padding-left:18px;">
    <li>Check in/ Check out time: Siliguri, Burdwan, Darjeeling and Kalimpong 12 noon/11 am; Dooars, Ooty and Port Blair 12 noon/10 am; Udaipur 1 pm/11 am; Gangtok 2pm/12 noon.</li>
    <li>No Show &mdash; Room kept only till following midday.</li>
    <li>Settlement of Invoice &mdash; At check out time, by cash/credit card (cash payment can only be accepted for amounts below Rs 2,00,000). For payments of Rs 50,000 and above, furnishing of PAN is mandatory. Credit card guarantee/deposit at the time of check in.</li>
    <li>In case of booking through Travel Agent or Tour Operator, the liability of the guest remains till hotel receives full payment from the agent/operator.</li>
    <li>Disputes &mdash; Under the jurisdiction of Kolkata courts only.</li>
    <li>Refunds &mdash; Only through head office at Kolkata. Refund of GST shall be done only after refund is received from GST authorities.</li>
    <li>All guests (every member of the family) are requested to please carry an original photo-identity together with address proof to be presented at check-in (Driving licence/Voter ID Card/Aadhaar Card/Passport). For foreign nationals &mdash; original passport and valid visa.</li>
    <li>Parking of guest vehicles will be at owner's risk and the liability remains with the guest or vehicle owner.</li>
  </ul>

  <p style="font-size:13px; font-weight:bold; margin:0 0 8px;">Cancellation Policy</p>
  <ul style="margin:0 0 16px; padding-left:18px;">
    <li><strong>Non-refundable rate</strong> &mdash; the booking cannot be cancelled or refunded.</li>
    <li><strong>Refundable rate</strong> &mdash; cancel free of charge up to the deadline shown on your confirmation and the full amount is refunded. After that deadline, no refund is made.</li>
    <li>No-shows and early departures are not refunded on either rate.</li>
    <li>Some dates are sold on non-refundable terms only. Where that applies, the refundable rate is not offered for those dates and the booking cannot be cancelled or refunded.</li>
    <li>Where a refund is due, it is returned to the original payment method and reaches you within 5&ndash;7 working days.</li>
  </ul>

  <p style="font-size:12px; font-weight:bold; margin:0 0 8px;">For Port Blair</p>
  <ul style="margin:0; padding-left:18px;">
    <li>No refunds would be made on the already purchased boat tickets/entry fees.</li>
  </ul>
</div>
`;
