'use client';

import { getAmenityIcon } from '@/components/amenity-icon';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { formatInr, formatStayDate } from '@/lib/booking';
import { formatRoomSize } from '@/lib/room-size';
import { SCARCITY_THRESHOLD } from '@/lib/room-table';
import type { RateOption, RoomRow, UnavailableRow } from '@/lib/room-table';
import type { RatePlanCode } from '@prisma/client';
import Image from 'next/image';
import { useState } from 'react';

const MAX_FACILITIES = 6;

export interface StayQuery {
  slug: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
}

interface Selection {
  roomTypeId: string;
  ratePlanId: string;
  rateType: string;
  quantity: number;
}

export function BookingRoomTable({
  rooms,
  unavailable,
  planCodes,
  stay,
}: {
  rooms: RoomRow[];
  unavailable: UnavailableRow[];
  planCodes: RatePlanCode[];
  stay: StayQuery;
}) {
  const [plan, setPlan] = useState<RatePlanCode>(planCodes[0] ?? 'EP');
  // One selection, not a basket: a booking holds one room type, so choosing a
  // different room replaces the choice rather than adding to it. Said on the
  // summary, because silently dropping the first pick would be worse.
  const [selection, setSelection] = useState<Selection | null>(null);

  const selected = selection
    ? rooms.find((room) => room.roomTypeId === selection.roomTypeId)
    : undefined;
  const selectedRate = selected?.plans
    .find((entry) => entry.rates.some((rate) => rate.ratePlanId === selection?.ratePlanId))
    ?.rates.find(
      (rate) => rate.ratePlanId === selection?.ratePlanId && rate.rateType === selection?.rateType,
    );

  const reserveHref =
    selection && selectedRate
      ? `/book/${stay.slug}/confirm?${new URLSearchParams({
          roomType: selection.roomTypeId,
          ratePlan: selection.ratePlanId,
          rateType: selection.rateType,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          rooms: String(selection.quantity),
          adults: String(stay.adults),
          children: String(stay.children),
        })}`
      : null;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="min-w-0">
        {planCodes.length > 1 && (
          <fieldset className="mb-4 inline-flex rounded-lg border border-ink/15 bg-white p-1">
            <legend className="sr-only">Meal plan</legend>
            {rooms[0]?.plans.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => {
                  setPlan(entry.code);
                  // The selection names a rate plan, and the other plan's
                  // rates have different ids and different prices.
                  setSelection(null);
                }}
                aria-pressed={plan === entry.code}
                className={`rounded px-4 py-1.5 text-sm transition ${
                  plan === entry.code ? 'bg-forest text-cream' : 'text-ink/65 hover:text-forest'
                }`}
              >
                {entry.name}
              </button>
            ))}
          </fieldset>
        )}

        {/* Desktop: one table, a room's cell spanning its rates. Phones get the
            same facts as stacked blocks — a six-column table on a 390px screen
            is a horizontal scroll nobody completes. */}
        <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white md:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead className="bg-forest text-[11px] uppercase tracking-wide text-cream/90">
              <tr>
                <th className="w-[28%] px-4 py-3 font-medium">Room type</th>
                <th className="w-[15%] px-4 py-3 font-medium">Sleeps</th>
                <th className="w-[19%] px-4 py-3 font-medium">Price for your stay</th>
                <th className="w-[24%] px-4 py-3 font-medium">Your choices</th>
                <th className="w-[14%] px-4 py-3 font-medium">Select</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => {
                const rates = room.plans.find((entry) => entry.code === plan)?.rates ?? [];
                return rates.map((rate, index) => (
                  <tr
                    key={`${room.roomTypeId}:${rate.rateType}`}
                    className="border-b border-ink/10 align-top last:border-0"
                  >
                    {index === 0 && (
                      <td rowSpan={rates.length} className="border-r border-ink/10 px-4 py-4">
                        <RoomCell room={room} />
                      </td>
                    )}
                    {index === 0 && (
                      <td rowSpan={rates.length} className="border-r border-ink/10 px-4 py-4">
                        <Sleeps room={room} />
                      </td>
                    )}
                    <td className="border-r border-ink/10 px-4 py-4">
                      <p className="font-display text-lg text-forest">{formatInr(rate.total)}</p>
                      <p className="text-xs leading-snug text-ink/55">
                        {formatInr(rate.perNight)} per night
                      </p>
                      <p className="text-xs text-ink/45">incl. {formatInr(rate.taxTotal)} GST</p>
                    </td>
                    <td className="border-r border-ink/10 px-4 py-4">
                      <Choices rate={rate} />
                    </td>
                    <td className="px-4 py-4">
                      <SelectQuantity
                        room={room}
                        rate={rate}
                        selection={selection}
                        onChange={setSelection}
                      />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {rooms.map((room) => {
            const rates = room.plans.find((entry) => entry.code === plan)?.rates ?? [];
            return (
              <div
                key={room.roomTypeId}
                className="overflow-hidden rounded-xl border border-ink/10 bg-white"
              >
                <div className="p-4">
                  <RoomCell room={room} />
                  <div className="mt-3">
                    <Sleeps room={room} />
                  </div>
                </div>
                {rates.map((rate) => (
                  <div key={rate.rateType} className="border-t border-ink/10 bg-cream/40 px-4 py-3">
                    <Choices rate={rate} />
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-display text-lg text-forest">{formatInr(rate.total)}</p>
                        <p className="text-xs text-ink/55">
                          {formatInr(rate.perNight)} per room / night · incl.{' '}
                          {formatInr(rate.taxTotal)} GST
                        </p>
                      </div>
                      <SelectQuantity
                        room={room}
                        rate={rate}
                        selection={selection}
                        onChange={setSelection}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {unavailable.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-ink/10 bg-ink/[0.03]">
            {unavailable.map((room) => (
              <div
                key={room.roomTypeId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 px-4 py-3 last:border-0"
              >
                <p className="font-display text-base text-ink/45">{room.name}</p>
                <p className="text-xs uppercase tracking-wider text-ink/40">{room.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-6">
        <div className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">Your stay</p>
          {selection && selected && selectedRate ? (
            <>
              <p className="mt-3 font-display text-lg leading-tight text-forest">{selected.name}</p>
              <p className="text-xs uppercase tracking-wider text-gold-dark">
                {selected.plans.find((entry) => entry.code === plan)?.name}
              </p>
              <p className="mt-1 text-sm text-ink/70">
                {selection.quantity} {selection.quantity === 1 ? 'room' : 'rooms'} · {stay.adults}{' '}
                {stay.adults === 1 ? 'adult' : 'adults'}
                {stay.children > 0 ? ` · ${stay.children} children` : ''}
              </p>
              <p className="mt-3 font-display text-2xl text-forest">
                {formatInr(selectedRate.total * selection.quantity)}
              </p>
              <p className="text-xs text-ink/55">
                incl. {formatInr(selectedRate.taxTotal * selection.quantity)} GST
              </p>
              <p className="mt-2 text-xs text-ink/60">{cancellationLine(selectedRate)}</p>
              <a
                href={reserveHref ?? '#'}
                className="mt-4 block rounded bg-gold py-2.5 text-center text-sm uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
              >
                Reserve
              </a>
              <p className="mt-2 text-[11px] leading-snug text-ink/45">
                One room type per booking — choosing another replaces this.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink/55">
              Pick a room and a rate to see the total for your stay.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function RoomCell({ room }: { room: RoomRow }) {
  const size = formatRoomSize(room.sizeSqFt);
  const facilities = room.amenities.slice(0, MAX_FACILITIES);

  return (
    <div>
      <p className="font-display text-lg leading-tight text-forest">{room.name}</p>
      <p className="mt-0.5 text-xs text-ink/55">
        {[room.bedType, size, room.view].filter(Boolean).join(' · ')}
      </p>

      {facilities.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {facilities.map((facility) => {
            const Icon = getAmenityIcon(facility);
            return (
              <li key={facility} className="flex items-center gap-1 text-xs text-ink/65">
                {/* The stroke classes have to come along: className replaces
                    the icon's own default rather than adding to it, and
                    without them the SVG falls back to a solid black fill. */}
                <Icon className="h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-[1.6] text-gold-dark" />
                {facility}
              </li>
            );
          })}
        </ul>
      )}

      {(room.description || room.images.length > 0) && (
        <Dialog>
          <DialogTrigger className="mt-2 text-xs uppercase tracking-wider text-forest underline-offset-4 hover:underline">
            See details
          </DialogTrigger>
          <DialogContent title={room.name} size="lg">
            <div className="overflow-y-auto">
              {room.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {room.images.slice(0, 6).map((image) => (
                    <div key={image} className="relative aspect-[4/3] overflow-hidden rounded">
                      <Image
                        src={image}
                        alt={room.name}
                        fill
                        sizes="(min-width: 640px) 20rem, 50vw"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              {room.description && (
                <p className="mt-4 text-sm leading-relaxed text-ink/75">{room.description}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {room.roomsLeft <= SCARCITY_THRESHOLD && (
        <p className="mt-2 text-xs font-medium text-red-700">Only {room.roomsLeft} left</p>
      )}
    </div>
  );
}

function Sleeps({ room }: { room: RoomRow }) {
  return (
    <div>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: room.baseOccupancy }, (_, i) => (
          <GuestIcon key={`guest-${room.roomTypeId}-${i}`} />
        ))}
      </div>
      <p className="sr-only">Sleeps {room.baseOccupancy}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink/55">Extra guests charged per night</p>
    </div>
  );
}

function Choices({ rate }: { rate: RateOption }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-forest">
        {rate.rateType === 'REFUNDABLE' ? 'Free cancellation' : 'Non-refundable'}
      </p>
      <p className="text-xs leading-snug text-ink/65">{cancellationLine(rate)}</p>
      <p className="text-xs text-ink/65">
        {rate.breakfastGuests > 0
          ? `Breakfast included for ${rate.breakfastGuests}`
          : 'Breakfast not included'}
      </p>
    </div>
  );
}

function cancellationLine(rate: RateOption): string {
  if (rate.rateType === 'REFUNDABLE' && rate.cancellationDeadline) {
    return `Cancel free until ${formatStayDate(rate.cancellationDeadline)}`;
  }
  return 'No refund if cancelled';
}

function SelectQuantity({
  room,
  rate,
  selection,
  onChange,
}: {
  room: RoomRow;
  rate: RateOption;
  selection: Selection | null;
  onChange: (next: Selection | null) => void;
}) {
  const isThis =
    selection?.roomTypeId === room.roomTypeId &&
    selection?.ratePlanId === rate.ratePlanId &&
    selection?.rateType === rate.rateType;
  const value = isThis ? selection.quantity : 0;
  const id = `qty-${room.roomTypeId}-${rate.rateType}`;

  return (
    <label className="block">
      <span className="sr-only">
        Rooms of {room.name} at the{' '}
        {rate.rateType === 'REFUNDABLE' ? 'refundable' : 'non-refundable'} rate
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const quantity = Number(event.target.value);
          onChange(
            quantity === 0
              ? null
              : {
                  roomTypeId: room.roomTypeId,
                  ratePlanId: rate.ratePlanId,
                  rateType: rate.rateType,
                  quantity,
                },
          );
        }}
        className="select w-20 py-1.5 text-sm"
      >
        <option value={0}>0</option>
        {Array.from({ length: room.roomsLeft }, (_, i) => i + 1).map((quantity) => (
          <option key={quantity} value={quantity}>
            {quantity}
          </option>
        ))}
      </select>
    </label>
  );
}

function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-forest" fill="currentColor" aria-hidden="true">
      <title>Guest</title>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5z" />
    </svg>
  );
}
