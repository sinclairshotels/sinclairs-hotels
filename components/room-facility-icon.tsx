import { getAmenityIcon } from '@/components/amenity-icon';
import type { JSX } from 'react';

// The "In your room" icons. Separate from components/amenity-icon.tsx because
// they answer a different question — that file matches free text about the
// hotel, this one is keyed by lib/room-facilities.ts's fixed catalogue, so a
// television is always the same drawing rather than whatever a keyword happened
// to hit. Hand-drawn inline SVG, no icon library, as everywhere else here.

type IconProps = { className?: string };

const base = 'h-5 w-5 stroke-current fill-none stroke-[1.6]';

function svg(children: JSX.Element) {
  return function Icon({ className = base }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}

const BedIcon = svg(
  <>
    <path d="M3 18v-9M3 13h18v5M21 18v-5" />
    <path d="M7 13v-3h5a4 4 0 0 1 4 3" />
  </>,
);

const BathIcon = svg(
  <>
    <path d="M4 12h16v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    <path d="M7 12V6a2 2 0 0 1 3.5-1.3" />
    <path d="M6.5 20l-1 1M17.5 20l1 1" />
  </>,
);

const ShowerIcon = svg(
  <>
    <path d="M5 21V7a3 3 0 0 1 6 0" />
    <path d="M12 8h9M16.5 8v-2" />
    <path d="M14 13v1M17 12v2M20 13v1M15.5 17v1M18.5 17v1" />
  </>,
);

const AirConditioningIcon = svg(
  <>
    <rect x="3" y="5" width="18" height="7" rx="2" />
    <path d="M6 9h12" />
    <path d="M7 15c0 2 2 2 2 4M12 15c0 2 2 2 2 4M17 15c0 2 2 2 2 4" />
  </>,
);

const HeaterIcon = svg(
  <>
    <rect x="4" y="7" width="16" height="12" rx="2" />
    <path d="M8 7v12M12 7v12M16 7v12" />
    <path d="M6 4c1 1 3 1 4 0s3-1 4 0" />
  </>,
);

const FireplaceIcon = svg(
  <>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M12 17c-1.7 0-3-1.2-3-2.8 0-1.8 1.6-2.6 1.6-4.2 1.9.8 1.4 2.3 2.3 1.6.6-.5.5-1.4.5-1.4 1.1 1 1.6 2.3 1.6 4C15 15.8 13.7 17 12 17z" />
  </>,
);

const TvIcon = svg(
  <>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M9 21h6M12 17v4" />
  </>,
);

const TeaIcon = svg(
  <>
    <path d="M5 9h12v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
    <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
    <path d="M9 6c0-1 1-1.5 1-2.5M13 6c0-1 1-1.5 1-2.5" />
  </>,
);

const FridgeIcon = svg(
  <>
    <rect x="6" y="3" width="12" height="18" rx="2" />
    <path d="M6 10h12" />
    <path d="M9 6.5v2M9 13v2.5" />
  </>,
);

const MinibarIcon = svg(
  <>
    <path d="M5 4h14l-7 7z" />
    <path d="M12 11v7M9 18h6" />
  </>,
);

const SafeIcon = svg(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="11" cy="12" r="3.5" />
    <path d="M11 8.5v-1M11 16.5v1M17 9v6" />
  </>,
);

const DeskIcon = svg(
  <>
    <path d="M3 8h18M4 8v12M20 8v12" />
    <path d="M4 14h7v4H4z" />
  </>,
);

const BalconyIcon = svg(
  <>
    <path d="M3 12h18M5 12v8M19 12v8M9 12v8M15 12v8" />
    <path d="M3 20h18" />
    <path d="M7 8a5 5 0 0 1 10 0" />
  </>,
);

const SofaIcon = svg(
  <>
    <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
    <path d="M3 12a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v6H3z" />
  </>,
);

const DiningTableIcon = svg(
  <>
    <path d="M3 10h18M6 10v9M18 10v9" />
    <path d="M12 3v7M9 6h6" />
  </>,
);

const WardrobeIcon = svg(
  <>
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <path d="M12 3v18M10 11v2M14 11v2" />
  </>,
);

const PhoneIcon = svg(
  <path d="M5 4h4l1.5 4L8 9.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
);

const LivingRoomIcon = svg(
  <>
    <path d="M3 21V9l9-6 9 6v12" />
    <path d="M3 21h18M12 21v-6h4v6" />
  </>,
);

const SitOutIcon = svg(
  <>
    <path d="M12 3v3M6.5 5.5 8 8M17.5 5.5 16 8M3 12h4M17 12h4" />
    <circle cx="12" cy="12" r="4" />
    <path d="M4 21h16" />
  </>,
);

const BY_KEY: Record<string, (p: IconProps) => JSX.Element> = {
  bed: BedIcon,
  'king-bed': BedIcon,
  'queen-bed': BedIcon,
  'twin-beds': BedIcon,
  'double-bed': BedIcon,
  'day-bed': BedIcon,
  ensuite: BathIcon,
  'rain-shower': ShowerIcon,
  'hot-water': ShowerIcon,
  bathtub: BathIcon,
  'air-conditioning': AirConditioningIcon,
  heater: HeaterIcon,
  fireplace: FireplaceIcon,
  tv: TvIcon,
  'tea-coffee': TeaIcon,
  minibar: MinibarIcon,
  fridge: FridgeIcon,
  safe: SafeIcon,
  desk: DeskIcon,
  balcony: BalconyIcon,
  'balcony-plain': BalconyIcon,
  'sit-out': SitOutIcon,
  'living-room': LivingRoomIcon,
  sofa: SofaIcon,
  'dining-table': DiningTableIcon,
  wardrobe: WardrobeIcon,
  phone: PhoneIcon,
  'room-service': getAmenityIcon('in-room dining'),
};

// Wi-Fi already exists in the amenity set and there is no reason to draw a
// second one; a curated extra ("Mood lighting") has no key, so it falls back to
// the keyword matcher and, failing that, a tick.
export function getRoomFacilityIcon(key: string, label: string) {
  return BY_KEY[key] ?? getAmenityIcon(label);
}
