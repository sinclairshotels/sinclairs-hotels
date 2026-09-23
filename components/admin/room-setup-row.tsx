'use client';

import {
  type SetupState,
  deactivateRoomType,
  saveRoomType,
} from '@/app/admin/(dashboard)/rates/room-actions';
import type { RoomFacility } from '@/lib/room-facilities';
import { useActionState, useEffect, useRef, useState } from 'react';

const initial: SetupState = { status: 'idle' };

export interface SetupRoom {
  roomTypeId: string;
  roomName: string;
  baseOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  extraAdultCharge: number;
  extraChildCharge: number;
  sizeSqFt: number | null;
  hasPhoto: boolean;
  // Every facility this room could claim, and the ones it shows today —
  // staff's list where they have made one, the room's own copy otherwise.
  facilityOptions: RoomFacility[];
  facilities: string[];
}

export function RoomSetupRow({ hotelSlug, room }: { hotelSlug: string; room: SetupRoom }) {
  const [state, formAction, pending] = useActionState(saveRoomType, initial);
  const [removeState, removeAction, removing] = useActionState(deactivateRoomType, initial);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(room.roomName);
  const [armed, setArmed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameRef.current?.select();
  }, [editingName]);

  useEffect(() => {
    setName(room.roomName);
  }, [room.roomName]);

  // Only the name is tracked: the occupancy boxes are uncontrolled, and a
  // hint that cannot tell whether they moved would cry wolf on every row.
  const renamedButUnsaved = name !== room.roomName;

  return (
    <div className="space-y-2">
      <form action={formAction} id={`room-${room.roomTypeId}`}>
        <input type="hidden" name="hotelSlug" value={hotelSlug} />
        <input type="hidden" name="roomTypeId" value={room.roomTypeId} />

        {editingName ? (
          <input
            ref={nameRef}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setEditingName(false)}
            aria-label={`Name of ${room.roomName}`}
            className="input w-full px-2 py-1 text-sm font-medium"
          />
        ) : (
          <>
            <input type="hidden" name="name" value={name} />
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-left font-medium text-ink underline decoration-dotted decoration-ink/30 underline-offset-4 transition hover:decoration-forest"
              title="Click to rename"
            >
              {name}
            </button>
          </>
        )}

        {!room.hasPhoto && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gold-dark">No photo yet</p>
        )}
        {room.sizeSqFt === null && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gold-dark">No size yet</p>
        )}

        {/* Square feet only. The site prints metres beside it, worked out from
            this one number, so there is nothing here for the two to disagree
            about. Blank is a real answer — the tile then shows no size. */}
        <FieldGroup label="Room size">
          <label className="block">
            <span className="block text-[9px] uppercase tracking-wider text-ink/40">Sq ft</span>
            <input
              type="number"
              min={0}
              name="sizeSqFt"
              defaultValue={room.sizeSqFt ?? ''}
              placeholder="not measured"
              aria-label={`${room.roomName} size in square feet`}
              className="input w-full px-1.5 py-0.5 text-xs"
            />
          </label>
        </FieldGroup>

        <FacilityChecklist room={room} />

        <FieldGroup label="Included in the rate">
          <div className="grid grid-cols-3 gap-1">
            <Small label="Guests" name="baseOccupancy" value={room.baseOccupancy} room={room} />
            <Small label="Adults" name="maxAdults" value={room.maxAdults} room={room} />
            <Small label="Children" name="maxChildren" value={room.maxChildren} room={room} />
          </div>
        </FieldGroup>

        {/* Their own columns rather than two more boxes in the occupancy grid:
            these are money, and reading them as occupancy numbers is how a
            charge gets typed into a headcount. */}
        <FieldGroup label="Extra guest fee, per night">
          <div className="grid grid-cols-2 gap-2">
            <Small
              label="Adult ₹"
              name="extraAdultCharge"
              value={room.extraAdultCharge}
              room={room}
            />
            <Small
              label="Child ₹"
              name="extraChildCharge"
              value={room.extraChildCharge}
              room={room}
            />
          </div>
        </FieldGroup>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-forest/40 px-2 py-1 text-[10px] uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save room'}
          </button>
          {!armed && (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="text-[10px] uppercase tracking-wider text-red-700 transition hover:text-red-900"
            >
              Remove
            </button>
          )}
        </div>
      </form>

      {armed && (
        <form action={removeAction} className="flex items-center gap-2">
          <input type="hidden" name="hotelSlug" value={hotelSlug} />
          <input type="hidden" name="roomTypeId" value={room.roomTypeId} />
          <button
            type="submit"
            disabled={removing}
            aria-label={`Confirm removing ${room.roomName}`}
            className="rounded bg-red-700 px-2 py-1 text-[10px] uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {removing ? 'Removing…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-[10px] uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Keep
          </button>
          <span className="text-[10px] text-ink/50">Hidden from the site; history kept.</span>
        </form>
      )}

      {state.message && (
        <p
          className={`text-[10px] ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
      {removeState.message && (
        <p
          className={`text-[10px] ${removeState.status === 'error' ? 'text-red-700' : 'text-forest'}`}
          aria-live="polite"
        >
          {removeState.message}
        </p>
      )}
      {renamedButUnsaved && !pending && (
        <p className="text-[10px] text-gold-dark">Renamed — press Save room.</p>
      )}
    </div>
  );
}

// Closed by default: it is a long list and most visits here are about money.
// `facilitiesEdited` is what keeps an untouched room reading its description —
// without it, pressing Save room would freeze today's derived list into the
// database and a later content edit would stop reaching the site.
function FacilityChecklist({ room }: { room: SetupRoom }) {
  const [edited, setEdited] = useState(false);
  const shown = new Set(room.facilities);

  return (
    <details className="mt-2 rounded border border-ink/10 px-2 py-1">
      <summary className="cursor-pointer text-[9px] uppercase tracking-wider text-ink/35">
        In your room ({room.facilities.length})
      </summary>
      {edited && <input type="hidden" name="facilitiesEdited" value="1" />}
      <p className="mt-1 text-[10px] text-ink/50">Shown on the website under each room.</p>
      <div className="mt-1 max-h-48 overflow-y-auto pr-1">
        {room.facilityOptions.map((facility) => (
          <label key={facility.key} className="flex items-center gap-1.5 py-0.5 text-[11px]">
            <input
              type="checkbox"
              name="facilities"
              value={facility.key}
              defaultChecked={shown.has(facility.key)}
              onChange={() => setEdited(true)}
              className="h-3 w-3"
            />
            {facility.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[9px] uppercase tracking-wider text-ink/35">{label}</p>
      {children}
    </div>
  );
}

function Small({
  label,
  name,
  value,
  room,
}: {
  label: string;
  name: string;
  value: number;
  room: SetupRoom;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider text-ink/40">{label}</span>
      <input
        type="number"
        min={0}
        name={name}
        defaultValue={value}
        aria-label={`${room.roomName} ${label}`}
        className="input w-full px-1.5 py-0.5 text-xs"
      />
    </label>
  );
}
