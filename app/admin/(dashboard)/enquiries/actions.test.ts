import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { addEnquiryNote, assignEnquiry, forwardEnquiry, setEnquiryStatus } from './actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'enquiry-actions-test',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'staff_session' && mockState.cookieValue
        ? { value: mockState.cookieValue }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) =>
      name === 'x-real-ip' ? mockState.ip : name === 'host' ? 'staff.localhost:3000' : null,
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/mail', () => ({
  sendMail: vi.fn(),
  STAFF_NOTIFY_EMAIL: 'staff@example.com',
  VOUCHER_OFFICE_EMAIL: 'office@example.com',
}));

const GUEST_DOMAIN = 'vitest-enquiry.invalid';

async function makeEnquiry() {
  return prisma.enquiry.create({
    data: {
      name: 'A Guest',
      email: `guest-${Math.random().toString(36).slice(2, 8)}@${GUEST_DOMAIN}`,
      phone: '+91 90000 00000',
      property: 'gangtok',
      message: 'Do you have a room with a view of Kanchenjunga in October?',
    },
  });
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

beforeEach(async () => {
  vi.mocked(sendMail).mockClear();
  const staff = await createTestStaff({ role: 'USER', sections: { enquiries: 'EDIT' } });
  mockState.cookieValue = staff.token;
});

afterAll(async () => {
  await prisma.enquiry.deleteMany({ where: { email: { endsWith: GUEST_DOMAIN } } });
  await cleanupTestStaff();
  await prisma.$disconnect();
});

describe('assignEnquiry', () => {
  it('assigns, records who, and emails the assignee a link', async () => {
    const enquiry = await makeEnquiry();
    const assignee = await createTestStaff({ role: 'USER', sections: { enquiries: 'VIEW' } });

    const state = await assignEnquiry(
      { status: 'idle' },
      form({ id: enquiry.id, userId: assignee.id }),
    );

    expect(state.status).toBe('success');
    const after = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.assignedToUserId).toBe(assignee.id);
    expect(after.assignedAt).not.toBeNull();

    const mail = vi.mocked(sendMail).mock.calls.at(-1)?.[0];
    expect(mail?.to).toBe(assignee.email);
    expect(mail?.html).toContain(`/admin/enquiries/${enquiry.id}`);
    // The guest's details stay out of a mail that lands in a shared inbox.
    expect(mail?.html).not.toContain(after.email);
    expect(mail?.html).not.toContain('Kanchenjunga');
  });

  it('refuses an account that is not active', async () => {
    const enquiry = await makeEnquiry();
    const gone = await createTestStaff({ role: 'USER', active: false });

    const state = await assignEnquiry(
      { status: 'idle' },
      form({ id: enquiry.id, userId: gone.id }),
    );

    expect(state.status).toBe('error');
  });
});

describe('setEnquiryStatus', () => {
  it('marks contacted and records who and when', async () => {
    const enquiry = await makeEnquiry();

    const state = await setEnquiryStatus(
      { status: 'idle' },
      form({ id: enquiry.id, status: 'CONTACTED' }),
    );

    expect(state.status).toBe('success');
    const after = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe('CONTACTED');
    expect(after.statusChangedAt).not.toBeNull();
    expect(after.statusChangedLabel).toContain('@');
  });

  // Closing without a reason loses the only thing anyone asks afterwards.
  it('refuses to close without a reason', async () => {
    const enquiry = await makeEnquiry();

    const state = await setEnquiryStatus(
      { status: 'idle' },
      form({ id: enquiry.id, status: 'CLOSED' }),
    );

    expect(state.status).toBe('error');
    const after = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe('NEW');
  });

  it('closes with a reason and reopens', async () => {
    const enquiry = await makeEnquiry();

    await setEnquiryStatus(
      { status: 'idle' },
      form({ id: enquiry.id, status: 'CLOSED', closeReason: 'BOOKED' }),
    );
    let after = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe('CLOSED');
    expect(after.closeReason).toBe('BOOKED');

    await setEnquiryStatus({ status: 'idle' }, form({ id: enquiry.id, status: 'NEW' }));
    after = await prisma.enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe('NEW');
    // Reopening drops the reason: it described a close that no longer stands.
    expect(after.closeReason).toBeNull();
  });

  it('writes an audit entry for every change', async () => {
    const enquiry = await makeEnquiry();
    await setEnquiryStatus({ status: 'idle' }, form({ id: enquiry.id, status: 'CONTACTED' }));

    const events = await prisma.auditEvent.findMany({
      where: { entity: 'Enquiry', entityId: enquiry.id },
    });
    expect(events.map((e) => e.action)).toContain('enquiry.status_changed');
  });
});

describe('forwardEnquiry', () => {
  it('emails the enquiry on and records where it went', async () => {
    const enquiry = await makeEnquiry();

    const state = await forwardEnquiry(
      { status: 'idle' },
      form({ id: enquiry.id, address: 'someone@example.com' }),
    );

    expect(state.status).toBe('success');
    const mail = vi.mocked(sendMail).mock.calls.at(-1)?.[0];
    expect(mail?.to).toBe('someone@example.com');
    expect(mail?.html).toContain('Kanchenjunga');

    const events = await prisma.auditEvent.findMany({
      where: { entity: 'Enquiry', entityId: enquiry.id, action: 'enquiry.forwarded' },
    });
    expect(events[0]?.summary).toContain('someone@example.com');
  });

  it('rejects an address that is not one', async () => {
    const enquiry = await makeEnquiry();
    const state = await forwardEnquiry(
      { status: 'idle' },
      form({ id: enquiry.id, address: 'not-an-email' }),
    );
    expect(state.status).toBe('error');
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });
});

describe('addEnquiryNote', () => {
  it('appends an entry with its author and time', async () => {
    const enquiry = await makeEnquiry();

    await addEnquiryNote(
      { status: 'idle' },
      form({ id: enquiry.id, body: 'Quoted 8,500 for two nights.' }),
    );

    const notes = await prisma.enquiryNote.findMany({ where: { enquiryId: enquiry.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toBe('Quoted 8,500 for two nights.');
    expect(notes[0]?.authorLabel).toContain('@');
    expect(notes[0]?.authorUserId).not.toBeNull();
    expect(notes[0]?.at).toBeInstanceOf(Date);
  });

  // The whole point of the change: a second note must not cost the first one.
  it('never overwrites an earlier note, and reads newest first', async () => {
    const enquiry = await makeEnquiry();

    await addEnquiryNote(
      { status: 'idle' },
      form({ id: enquiry.id, body: 'First: left a voicemail.' }),
    );
    await addEnquiryNote(
      { status: 'idle' },
      form({ id: enquiry.id, body: 'Second: they called back.' }),
    );

    const notes = await prisma.enquiryNote.findMany({
      where: { enquiryId: enquiry.id },
      orderBy: { at: 'desc' },
    });
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.body)).toContain('First: left a voicemail.');
    expect(notes[0]?.at.getTime()).toBeGreaterThanOrEqual(notes[1]?.at.getTime() ?? 0);
  });

  it('refuses an empty note rather than storing a blank entry', async () => {
    const enquiry = await makeEnquiry();

    const state = await addEnquiryNote({ status: 'idle' }, form({ id: enquiry.id, body: '   ' }));

    expect(state.status).toBe('error');
    expect(await prisma.enquiryNote.count({ where: { enquiryId: enquiry.id } })).toBe(0);
  });

  it('goes away with the enquiry rather than being orphaned', async () => {
    const enquiry = await makeEnquiry();
    await addEnquiryNote({ status: 'idle' }, form({ id: enquiry.id, body: 'A note.' }));

    await prisma.enquiry.delete({ where: { id: enquiry.id } });

    expect(await prisma.enquiryNote.count({ where: { enquiryId: enquiry.id } })).toBe(0);
  });
});
