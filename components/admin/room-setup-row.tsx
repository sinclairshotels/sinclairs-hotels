'use client';

import {
  type SetupState,
  deactivateRoomType,
  saveRoomType,
} from '@/app/admin/(dashboard)/rates/room-actions';
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
  hasPhoto: boolean;
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
