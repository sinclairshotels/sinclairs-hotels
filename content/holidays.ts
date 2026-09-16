// Seed list for the editable Holiday table, used to shade the rates calendar.
//
// Only the fixed-date national holidays are listed. The movable festivals —
// Holi, Eid, Dussehra, Diwali, Guru Nanak Jayanti — shift in the Gregorian
// calendar every year, and those are exactly the dates a hill or heritage
// property prices its peak season around. Seeding a guessed Diwali would put
// the wrong column in shade and, worse, invite a season to be loaded against
// it. Staff add them for the year ahead in the admin, which is why the table
// is editable rather than a constant in code.
export const INDIAN_PUBLIC_HOLIDAYS: Array<{ date: string; name: string }> = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas Day' },
];
