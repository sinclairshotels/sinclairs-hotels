import { getHotelBySlug, hotels } from '@/content/hotels';
import { fileInfos, formatBytes, publicImagePaths } from '@/lib/photo-files';
import { photoPages } from '@/lib/photo-slots';
import { retiredPaths } from '@/lib/photos';

export interface LibraryPhoto {
  contentPath: string;
  fileName: string;
  group: string;
  width: number;
  height: number;
  size: string;
  // Where this photo is already used, as "Page · Section · Position". Shown in
  // the picker because reusing a photo somewhere else is usually fine and
  // sometimes a mistake, and only the person choosing can tell which.
  usedIn: string[];
}

const OTHER_GROUPS: Array<[prefix: string, label: string]> = [
  ['/images/weddings/', 'Weddings'],
  ['/images/experiences/', 'Experiences'],
  ['/images/awards/', 'Awards'],
  ['/images/press/', 'Press & Media'],
];

function groupOf(contentPath: string): string {
  const hotel = contentPath.match(/^\/images\/hotels\/([^/]+)\//)?.[1];
  if (hotel) return getHotelBySlug(hotel)?.name ?? hotel;
  for (const [prefix, label] of OTHER_GROUPS) {
    if (contentPath.startsWith(prefix)) return label;
  }
  return 'Other';
}

// Properties first and in site order, the way every other listing here reads,
// rather than alphabetically — which put the six award badges above all nine
// hotels.
const GROUP_ORDER = new Map<string, number>([
  ...hotels.map((hotel, i) => [hotel.name, i] as const),
  ...OTHER_GROUPS.map(([, label], i) => [label, hotels.length + i] as const),
  ['Other', hotels.length + OTHER_GROUPS.length],
]);

const rankOf = (group: string) => GROUP_ORDER.get(group) ?? Number.MAX_SAFE_INTEGER;

// Every photo in the repository, with the positions it already fills. Built on
// demand rather than shipped with the page: it is a list of every file on the
// site, and most visits to /admin/photos never open the picker.
export async function photoLibrary(): Promise<LibraryPhoto[]> {
  const usage = new Map<string, string[]>();
  for (const page of photoPages()) {
    for (const section of page.sections) {
      for (const slot of section.slots) {
        const where = `${page.title} · ${section.title} · ${slot.label}`;
        usage.set(slot.contentPath, [...(usage.get(slot.contentPath) ?? []), where]);
      }
    }
  }

  const [paths, retired] = await Promise.all([publicImagePaths(), retiredPaths()]);
  const live = paths.filter((path) => !retired.has(path));
  const files = await fileInfos(live);

  return live
    .map((contentPath) => {
      const file = files.get(contentPath);
      return {
        contentPath,
        fileName: contentPath.slice(contentPath.lastIndexOf('/') + 1),
        group: groupOf(contentPath),
        width: file?.width ?? 0,
        height: file?.height ?? 0,
        size: file ? formatBytes(file.bytes) : '—',
        usedIn: usage.get(contentPath) ?? [],
      };
    })
    .sort((a, b) => rankOf(a.group) - rankOf(b.group) || a.fileName.localeCompare(b.fileName));
}
