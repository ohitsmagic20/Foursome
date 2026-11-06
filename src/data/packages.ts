// Stay-and-play packages at major US golf destinations.
// Prices are the published "from" rate (usually per person per night, double occupancy, before taxes)
// and change by date and availability, so every entry links to where to check and book.
// Checked November 2026. Sources: each resort's own site, and GolfPass Travel's package listings.

export interface StayPlay {
  id: string;
  resort: string;
  name: string;
  city: string;
  state: string;
  /** Airports a group would fly into; used to match a trip's destination. */
  airports?: string[];
  courses: string[];
  /** Nights and rounds as offered, e.g. "3 nights, 4 rounds" or "Up to 5 nights, up to 4 rounds". */
  shape?: string;
  includes?: string;
  /** Published starting price. Missing means the resort quotes per group. */
  price?: { from: number; per: 'person per night' | 'golfer per trip' | 'as listed'; to?: number; note?: string };
  /** Where to see current rates and book. */
  url: string;
  source: string;
  checked: string;
}

const GP = 'GolfPass Travel';
const NOV = 'Nov 2026';
const gp = (state: string, slug: string) => `https://www.golfpass.com/travel-advisor/golf-packages/${state}-golf-packages/${slug}/`;

export const PACKAGES: StayPlay[] = [
  // ---------- Wisconsin ----------
  { id: 'kohler-to-dye-four', resort: 'Destination Kohler', name: 'To Dye Four', city: 'Kohler', state: 'WI', airports: ['MKE'],
    courses: ['Whistling Straits (Straits)', 'Whistling Straits (Irish)', 'Blackwolf Run (River)', 'Blackwolf Run (Meadow Valleys)'],
    shape: '3 nights, 4 rounds', includes: 'The American Club or Inn on Woodlake; caddies at Whistling Straits, carts and forecaddies at Blackwolf Run, replay rounds when available.',
    price: { from: 557, per: 'person per night' }, url: gp('wisconsin', 'dye-abolical-golf-package'), source: GP, checked: NOV },
  { id: 'kohler-champions-trail', resort: 'Destination Kohler', name: 'Champions’ Trail', city: 'Kohler', state: 'WI', airports: ['MKE'],
    courses: ['Whistling Straits (Straits)', 'Blackwolf Run (River)', 'The Irish or Meadow Valleys', 'The Baths (par 3)'],
    shape: '2 nights, 3 rounds plus The Baths', includes: 'The American Club or Inn on Woodlake, caddie and cart fees, a half-hour lesson, replay rounds when available.',
    price: { from: 617, per: 'person per night', note: 'Caddie tips extra.' }, url: gp('wisconsin', 'golf-kohler-package'), source: GP, checked: NOV },
  { id: 'sand-valley', resort: 'Sand Valley', name: 'Lodging and golf through the resort', city: 'Nekoosa', state: 'WI', airports: ['CWA', 'MSN', 'MKE'],
    courses: ['Sand Valley', 'Mammoth Dunes', 'Sedge Valley', 'The Lido', 'The Sandbox (short course)'],
    includes: 'Book rooms or cottages and tee times together with the resort’s trip planner. Resort lodging can sell out a year ahead.',
    url: 'https://www.sandvalley.com/trip-planner', source: 'Sand Valley', checked: NOV },

  // ---------- Oregon ----------
  { id: 'bandon-dunes', resort: 'Bandon Dunes Golf Resort', name: 'Stay at the resort, book golf with it', city: 'Bandon', state: 'OR', airports: ['OTH', 'EUG', 'PDX'],
    courses: ['Bandon Dunes', 'Pacific Dunes', 'Bandon Trails', 'Old Macdonald', 'Sheep Ranch', 'Bandon Preserve (par 3)'],
    includes: 'Golf and rooms are priced separately; resort guests get the guest green fee rate and tee times.',
    price: { from: 115, to: 230, per: 'person per night', note: 'Lodging only, sharing a double room: January vs. June–September 2026. Green fees extra.' },
    url: 'https://bandondunesgolf.com/lodging-rates/', source: 'Bandon Dunes', checked: NOV },

  // ---------- North Carolina ----------
  { id: 'pinehurst-resort', resort: 'Pinehurst Resort', name: 'Pinehurst Golf Package', city: 'Pinehurst', state: 'NC', airports: ['RDU', 'FAY', 'CLT'],
    courses: ['No. 2 (premium)', 'No. 4', 'No. 10', 'No. 11', 'Classic courses', 'The Cradle (short course)'],
    shape: 'One round per night stayed', includes: 'Room, breakfast and dinner daily, one round per night. Other versions: Bed, Breakfast & Golf; Hidden Gems (15% less, no No. 2); unlimited-golf Premier package.',
    url: 'https://www.pinehurst.com/packages/', source: 'Pinehurst Resort', checked: NOV },
  { id: 'pine-needles', resort: 'Pine Needles Lodge & Golf Club', name: 'Stay & Play', city: 'Southern Pines', state: 'NC', airports: ['RDU', 'FAY', 'CLT'],
    courses: ['Pine Needles', 'Mid Pines', 'Tobacco Road', 'The New Course'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 167, per: 'person per night' }, url: gp('north-carolina', 'pine-needles-lodge-golf-club-stay-play-package'), source: GP, checked: NOV },
  { id: 'mid-pines', resort: 'Mid Pines Inn & Golf Club', name: 'Stay & Play', city: 'Southern Pines', state: 'NC', airports: ['RDU', 'FAY', 'CLT'],
    courses: ['Mid Pines', 'Pine Needles', 'Tobacco Road', 'The New Course'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 167, per: 'person per night' }, url: gp('north-carolina', 'mid-pines-inn-golf-club-stay-play-package'), source: GP, checked: NOV },
  { id: 'talamore', resort: 'Talamore Golf Resort', name: 'Stay & Play', city: 'Southern Pines', state: 'NC', airports: ['RDU', 'FAY', 'CLT'],
    courses: ['Mid Pines', 'Mid South', 'Tobacco Road', 'The New Course'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 137, per: 'person per night' }, url: gp('north-carolina', 'talamore-golf-resort-stay-play-package'), source: GP, checked: NOV },

  // ---------- South Carolina ----------
  { id: 'myrtle-beach-golf', resort: 'Myrtle Beach golf packages', name: 'Stay & play', city: 'Myrtle Beach', state: 'SC', airports: ['MYR', 'CRE'],
    courses: ['Your pick of dozens of area courses'], shape: 'Usually 3–4 nights, 3–5 rounds',
    includes: 'Condo or hotel plus tee times you choose. Many local packagers build these trips.',
    price: { from: 400, to: 1200, per: 'golfer per trip', note: '2026 typical totals: $400–$700 budget, $700–$1,000 mid-range, $1,000+ premium. Spring and fall cost the most.' },
    url: 'https://myrtlebeachgolf.com/packages/', source: 'myrtlebeachgolf.com', checked: NOV },
  { id: 'kiawah-villas', resort: 'The Villas at Kiawah Island', name: 'Stay & Play', city: 'Kiawah Island', state: 'SC', airports: ['CHS'],
    courses: ['The Ocean Course', 'Osprey Point', 'Turtle Point', 'Cougar Point', 'Oak Point'], includes: 'One- to four-bedroom villas.',
    price: { from: 239, per: 'person per night' }, url: gp('south-carolina', 'the-villas-at-kiawah-island-stay-play-package'), source: GP, checked: NOV },
  { id: 'kiawah-sanctuary', resort: 'The Sanctuary at Kiawah Island', name: 'Stay & Play', city: 'Kiawah Island', state: 'SC', airports: ['CHS'],
    courses: ['The Ocean Course', 'Osprey Point', 'Turtle Point', 'Cougar Point', 'Oak Point'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 337, per: 'person per night' }, url: gp('south-carolina', 'the-sanctuary-at-kiawah-island-stay-play-package'), source: GP, checked: NOV },
  { id: 'kiawah-groups', resort: 'Kiawah Island Golf Resort', name: 'Kiawah Ryder Cup Experience (groups of 12+)', city: 'Kiawah Island', state: 'SC', airports: ['CHS'],
    courses: ['The Ocean Course', 'Osprey Point', 'Turtle Point', 'Cougar Point', 'Oak Point'], includes: 'Built for buddy trips; the resort quotes it for your group.',
    url: 'https://kiawahresort.com/packages/', source: 'Kiawah Island Golf Resort', checked: NOV },
  { id: 'wild-dunes', resort: 'Wild Dunes Resort', name: 'Stay & Play', city: 'Isle of Palms', state: 'SC', airports: ['CHS'],
    courses: ['Wild Dunes Links', 'Wild Dunes Harbor', 'RiverTowne', 'Charleston National'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 369, per: 'person per night' }, url: gp('south-carolina', 'wild-dunes-resort-stay-play-package'), source: GP, checked: NOV },
  { id: 'charleston-francis-marion', resort: 'Francis Marion Hotel', name: 'Charleston Golf Experience', city: 'Charleston', state: 'SC', airports: ['CHS'],
    courses: ['RiverTowne', 'Charleston National', 'Wild Dunes Harbor', 'Wild Dunes Links', 'Stono Ferry'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 239, per: 'person per night' }, url: gp('south-carolina', 'francis-marion-hotel-stay-play'), source: GP, checked: NOV },
  { id: 'sea-pines', resort: 'Sea Pines Resort', name: 'Stay & Play', city: 'Hilton Head Island', state: 'SC', airports: ['SAV', 'HHH'],
    courses: ['Harbour Town Golf Links', 'Atlantic Dunes', 'Heron Point'], shape: 'Up to 7 nights, up to 5 rounds',
    price: { from: 385, per: 'person per night' }, url: gp('south-carolina', 'sea-pines-resort-stay-play-package'), source: GP, checked: NOV },
  { id: 'palmetto-dunes', resort: 'Palmetto Dunes Oceanfront Resort', name: 'Stay & Play', city: 'Hilton Head Island', state: 'SC', airports: ['SAV', 'HHH'],
    courses: ['Robert Trent Jones', 'Arthur Hills', 'George Fazio', 'Hilton Head National'], shape: 'Up to 7 nights, up to 5 rounds',
    price: { from: 255, per: 'person per night' }, url: gp('south-carolina', 'palmetto-dunes-oceanfront-resort-stay-play-package'), source: GP, checked: NOV },
  { id: 'westin-hilton-head', resort: 'The Westin Hilton Head Island', name: 'Stay & Play', city: 'Hilton Head Island', state: 'SC', airports: ['SAV', 'HHH'],
    courses: ['Oyster Reef', 'Robber’s Row', 'Barony', 'Shipyard'], shape: 'Up to 5 nights, up to 4 rounds',
    price: { from: 255, per: 'person per night' }, url: gp('south-carolina', 'the-westin-hilton-head-island-resort-spa-stay-play-package'), source: GP, checked: NOV },

  // ---------- Florida ----------
  { id: 'sawgrass-marriott', resort: 'Sawgrass Marriott Golf Resort', name: 'Stay & Play', city: 'Ponte Vedra Beach', state: 'FL', airports: ['JAX'],
    courses: ['TPC Sawgrass Stadium Course'], price: { from: 569, per: 'person per night' },
    url: gp('florida', 'sawgrass-marriott-golf-resort-stay-play-package'), source: GP, checked: NOV },
  { id: 'streamsong', resort: 'Streamsong Resort', name: 'Build-your-own stay and play', city: 'Bowling Green', state: 'FL', airports: ['TPA', 'MCO'],
    courses: ['Red', 'Blue', 'Black', 'The Chain (par 3)'], includes: 'Any mix of rounds and nights; resort guests pay about $50 less per round than day guests.',
    url: 'https://www.streamsongresort.com/golf/', source: 'Streamsong Resort', checked: NOV },
  { id: 'cabot-citrus', resort: 'Cabot Citrus Farms', name: 'Seasonal packages', city: 'Brooksville', state: 'FL', airports: ['TPA'],
    courses: ['Karoo', 'Roost'], includes: 'Packages change by season; check the current list.',
    url: 'https://cabot.com/citrusfarms/packages', source: 'Cabot', checked: NOV },
  { id: 'innisbrook', resort: 'Innisbrook Golf Resort', name: 'Stay & Play', city: 'Palm Harbor', state: 'FL', airports: ['TPA'],
    courses: ['Copperhead', 'Island', 'North', 'South'], price: { from: 285, per: 'person per night' },
    url: gp('florida', 'innisbrook-golf-resort-stay-play-package'), source: GP, checked: NOV },
  { id: 'bay-hill', resort: 'Arnold Palmer’s Bay Hill Club & Lodge', name: 'Stay & Play', city: 'Orlando', state: 'FL', airports: ['MCO'],
    courses: ['Bay Hill (Champion/Challenger)'], price: { from: 285, per: 'person per night' },
    url: gp('florida', 'arnold-palmers-bay-hill-club-lodge-stay-play-package'), source: GP, checked: NOV },
  { id: 'orlando-buddy', resort: 'The Fountains Resort Orlando', name: 'Orlando Buddy Trip', city: 'Orlando', state: 'FL', airports: ['MCO'],
    courses: ['Orange County National', 'Celebration', 'Shingle Creek', 'Falcon’s Fire'], shape: '3 nights, 4 rounds',
    price: { from: 97, per: 'person per night' }, url: gp('florida', 'orlando-buddy-trip-golf-package'), source: GP, checked: NOV },
  { id: 'orlando-ironman', resort: 'The Fountains Resort ChampionsGate', name: 'Orlando Ironman', city: 'Orlando', state: 'FL', airports: ['MCO'],
    courses: ['Orange County National (Panther Lake, Crooked Cat)', 'Omni ChampionsGate (International, National)', 'Celebration', 'Falcon’s Fire'], shape: '4 nights, 6 rounds',
    price: { from: 157, per: 'person per night' }, url: gp('florida', 'orlando-ironman-golf-package'), source: GP, checked: NOV },
  { id: 'best-of-orlando', resort: 'The Lodge at Orange County National', name: 'Best of Orlando', city: 'Orlando', state: 'FL', airports: ['MCO'],
    courses: ['Orange County National (Panther Lake, Crooked Cat)', 'Celebration'], shape: '2 nights, 3 rounds',
    price: { from: 77, per: 'person per night' }, url: gp('florida', 'best-of-orlando-golf-package'), source: GP, checked: NOV },
  { id: 'reunion', resort: 'Reunion Resort & Golf Club', name: 'Stay & Play', city: 'Kissimmee', state: 'FL', airports: ['MCO'],
    courses: ['Nicklaus', 'Watson', 'Palmer'], price: { from: 215, per: 'person per night' },
    url: gp('florida', 'reunion-resort-golf-club-stay-play-package'), source: GP, checked: NOV },
  { id: 'omni-championsgate', resort: 'Omni Orlando Resort at ChampionsGate', name: 'Stay & Play', city: 'ChampionsGate', state: 'FL', airports: ['MCO'],
    courses: ['International', 'National', 'Celebration'], price: { from: 239, per: 'person per night' },
    url: gp('florida', 'omni-orlando-resort-at-championsgate-stay-play-package'), source: GP, checked: NOV },
  { id: 'doral', resort: 'Trump National Doral Miami', name: 'Stay & Play', city: 'Miami', state: 'FL', airports: ['MIA', 'FLL'],
    courses: ['Blue Monster', 'Golden Palm', 'Red Tiger', 'Silver Fox'], price: { from: 365, per: 'person per night' },
    url: gp('florida', 'trump-national-doral-miami-stay-play-package'), source: GP, checked: NOV },
  { id: 'turnberry', resort: 'JW Marriott Miami Turnberry', name: 'Stay & Play', city: 'Aventura', state: 'FL', airports: ['MIA', 'FLL'],
    courses: ['Miller', 'Soffer'], price: { from: 475, per: 'person per night' },
    url: gp('florida', 'jw-marriott-miami-turnberry-resort-spa-stay-play-package'), source: GP, checked: NOV },
  { id: 'omni-amelia', resort: 'Omni Amelia Island Resort', name: 'Stay & Play', city: 'Amelia Island', state: 'FL', airports: ['JAX'],
    courses: ['Oak Marsh', 'Amelia River Club'], price: { from: 415, per: 'person per night' },
    url: gp('florida', 'omni-amelia-island-resort-stay-play-package'), source: GP, checked: NOV },

  // ---------- Alabama ----------
  { id: 'rtj-mobile', resort: 'Battle House Renaissance Mobile', name: 'Robert Trent Jones Trail: Best of Mobile', city: 'Mobile', state: 'AL', airports: ['MOB', 'PNS'],
    courses: ['Magnolia Grove (Crossings, Falls)', 'Lakewood (Azalea or Dogwood)'], shape: '4 nights, 3 rounds',
    price: { from: 237, per: 'person per night' }, url: gp('alabama', 'rtj-best-of-mobile-package'), source: GP, checked: NOV },

  // ---------- Missouri ----------
  { id: 'big-cedar', resort: 'Big Cedar Lodge', name: 'Stay and play through the resort', city: 'Hollister', state: 'MO', airports: ['SGF', 'BKG'],
    courses: ['Payne’s Valley', 'Ozarks National', 'Buffalo Ridge', 'Top of the Rock (par 3)', 'Mountain Top (par 3)'],
    includes: 'Resort guests pay less per round and book further ahead than the public.',
    url: 'https://bigcedar.com/golf/', source: 'Big Cedar Lodge', checked: NOV },

  // ---------- Arizona ----------
  { id: 'wekopa', resort: 'We-Ko-Pa Casino Resort', name: 'Stay & Play', city: 'Fort McDowell', state: 'AZ', airports: ['PHX'],
    courses: ['We-Ko-Pa Saguaro', 'We-Ko-Pa Cholla', 'SunRidge Canyon'], shape: '3 nights, 3 rounds',
    price: { from: 217, per: 'person per night' }, url: gp('arizona', 'we-ko-pa-stay-play-golf-package'), source: GP, checked: NOV },

  // ---------- Michigan ----------
  { id: 'shanty-creek', resort: 'Shanty Creek Resort', name: 'Stay & Play', city: 'Bellaire', state: 'MI', airports: ['TVC'],
    courses: ['Cedar River', 'The Legend', 'Hawk’s Eye', 'Schuss', 'Summit'], url: 'https://www.golfpass.com/travel-advisor/golf-packages/michigan-golf-packages/', source: GP, checked: NOV },

  // ---------- California ----------
  { id: 'pebble-fairway-escape', resort: 'Pebble Beach Resorts', name: 'Fairway Escape', city: 'Pebble Beach', state: 'CA', airports: ['MRY', 'SJC', 'SFO'],
    courses: ['Pebble Beach Golf Links', 'Spyglass Hill', 'The Links at Spanish Bay'], shape: '3 nights, 3 rounds',
    includes: 'The Inn at Spanish Bay; staying at a Pebble Beach hotel is how you book Pebble Beach more than a couple of days out. Offered seasonally; call for current rates.',
    url: 'https://pebblebeach.com/golf-vacation-packages-and-getaways/fairway-escape', source: 'Pebble Beach Resorts', checked: NOV },
  { id: 'hyatt-monterey', resort: 'Hyatt Regency Monterey', name: 'Stay & Play', city: 'Monterey', state: 'CA', airports: ['MRY', 'SJC', 'SFO'],
    courses: ['Poppy Hills', 'Bayonet', 'Black Horse', 'Del Monte'], shape: 'Up to 5 nights, up to 4 rounds',
    url: gp('california', 'the-hyatt-regency-monterey-resort-spa-stay-play-package'), source: GP, checked: NOV },
  { id: 'la-quinta', resort: 'La Quinta Resort & Club', name: 'Stay & Play', city: 'La Quinta', state: 'CA', airports: ['PSP'],
    courses: ['PGA West Stadium', 'PGA West Nicklaus Tournament', 'Pete Dye Mountain', 'Pete Dye Dunes', 'Greg Norman'], shape: 'Up to 5 nights, up to 4 rounds',
    url: gp('california', 'la-quinta-resort-club-stay-play-package'), source: GP, checked: NOV },
  { id: 'palm-mountain', resort: 'Palm Mountain Resort & Spa', name: 'Stay & Play', city: 'Palm Springs', state: 'CA', airports: ['PSP'],
    courses: ['Indian Canyons (North, South)', 'The Classic Club', 'Tahquitz Creek (Resort, Legend)'], shape: 'Up to 5 nights, up to 4 rounds',
    url: gp('california', 'the-palm-mountain-resort-spa-stay-play-package'), source: GP, checked: NOV },
  { id: 'torrey-pines', resort: 'The Lodge at Torrey Pines', name: 'Stay & Play', city: 'La Jolla', state: 'CA', airports: ['SAN'],
    courses: ['Torrey Pines South', 'Torrey Pines North'], shape: 'Up to 5 nights, up to 4 rounds',
    url: gp('california', 'the-lodge-at-torrey-pines-stay-play-package'), source: GP, checked: NOV },
  { id: 'omni-la-costa', resort: 'Omni La Costa Resort & Spa', name: 'Stay & Play', city: 'Carlsbad', state: 'CA', airports: ['SAN'],
    courses: ['La Costa North', 'La Costa South', 'Aviara'], shape: 'Up to 5 nights, up to 4 rounds',
    url: gp('california', 'the-omni-la-costa-resort-spa-stay-play-package'), source: GP, checked: NOV },

  // ---------- Nevada ----------
  { id: 'mgm-grand', resort: 'MGM Grand Las Vegas', name: 'Stay & Play', city: 'Las Vegas', state: 'NV', airports: ['LAS'],
    courses: ['TPC Las Vegas', 'Aliante', 'Las Vegas Paiute (Snow, Sun Mountain)', 'Desert Pines'], shape: '2–5 nights, 2–4 rounds',
    price: { from: 157, per: 'person per night', note: 'From $197 with TPC Las Vegas. Resort fee paid at the hotel.' },
    url: gp('nevada', 'mgm-grand-hotel-casino-stay-play-package'), source: GP, checked: NOV },

  // ---------- Texas ----------
  { id: 'horseshoe-bay', resort: 'Horseshoe Bay Resort', name: 'Stay & Play', city: 'Horseshoe Bay', state: 'TX', airports: ['AUS'],
    courses: ['Ram Rock', 'Apple Rock', 'Slick Rock'], shape: '2–5 nights, 2–4 rounds',
    price: { from: 247, per: 'person per night' }, url: gp('texas', 'horseshoe-bay-resort-stay-play-package'), source: GP, checked: NOV },
];

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** Packages for a trip destination: same arrival airports, or same city and state. */
export function packagesFor(dest: { name: string; airports?: string[] }): StayPlay[] {
  const ports = new Set((dest.airports || []).map((a) => a.toUpperCase()));
  const [city = '', st = ''] = dest.name.split(',').map((x) => x.trim().toLowerCase());
  return PACKAGES.filter((p) => (p.airports || []).some((a) => ports.has(a)) || (p.city.toLowerCase() === city && p.state.toLowerCase() === st.slice(0, 2)))
    .sort((a, b) => (a.price?.from ?? 1e9) - (b.price?.from ?? 1e9));
}

export function priceLabel(p: StayPlay): string {
  if (!p.price) return 'Quoted per group';
  const $ = (n: number) => `$${n.toLocaleString('en-US')}`;
  const { from, to, per } = p.price;
  if (per === 'person per night') return `From ${$(from)}${to ? `–${$(to).slice(1)}` : ''} per person a night`;
  if (per === 'golfer per trip') return to ? `${$(from)}–${$(to).slice(1)}+ per golfer` : `From ${$(from)} per golfer`;
  return `From ${$(from)}`;
}
