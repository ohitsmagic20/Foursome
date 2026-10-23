// Ready-made golf trip ideas ("templates"). Starting a trip from one adds the destination and the rounds
// as suggestions for the group to vote on. Prices are per golfer, researched October 2026 from the
// sources listed on each idea. `verified: false` marks numbers we couldn't confirm from a current source.

export interface TemplateFee {
  low: number;
  high: number;
  /** Which season or year the numbers are from, e.g. "2027 rates" or "spring 2026". */
  asOf: string;
  verified: boolean;
  note?: string;
}

export interface TemplateRound {
  day: number;
  time: string;
  course: string;
  fee: TemplateFee;
  /** Booking rules that trip people up: walking only, resort guests only, caddies required… */
  access?: string;
  /** The course's own site, only when we've confirmed it. */
  url?: string;
  /** What to search on the map when OpenStreetMap doesn't list the course by name (e.g. the resort). */
  mapAs?: string;
}

export interface TripTemplate {
  slug: string;
  name: string;
  state: string;
  /** What goes into the trip's destination option (and the weather/course lookups). */
  destination: string;
  airports: string[];
  airportNote: string;
  nights: number;
  bestMonths: string;
  tagline: string;
  summary: string;
  rounds: TemplateRound[];
  lodging: { note: string; perNight: TemplateFee };
  tips: string[];
  sources: { label: string; url: string }[];
}

const FOOD_PER_DAY: [number, number] = [75, 125];

export const TEMPLATES: TripTemplate[] = [
  {
    slug: 'kohler-erin-hills',
    name: 'Kohler & Erin Hills',
    state: 'Wisconsin',
    destination: 'Kohler, WI',
    airports: ['MKE'],
    airportNote: 'Milwaukee (MKE) is within about an hour of both Kohler and Erin Hills, which are about an hour’s drive from each other.',
    nights: 3,
    bestMonths: 'Late May to mid-October (peak June–September)',
    tagline: 'A U.S. Open venue and a Ryder Cup course on Lake Michigan.',
    summary: 'The Midwest’s bucket-list trip: the Straits course at Whistling Straits, Erin Hills, and a round on the Irish course or Blackwolf Run. Big fees, walking-only courses, unforgettable golf.',
    rounds: [
      { day: 1, time: '1:00 PM', course: 'Blackwolf Run (Meadow Valleys)', fee: { low: 200, high: 300, asOf: 'estimate', verified: false }, access: 'Carts allowed. A good warm-up on arrival day.' },
      { day: 2, time: '8:00 AM', course: 'Whistling Straits (Straits)', fee: { low: 545, high: 645, asOf: '2025 rates', verified: true, note: 'Peak June to early October; shoulder about $100 less.' }, access: 'Walking only, caddie required (about $80 plus a $60–80 tip). Non-resort guests get a short booking window; stay-and-play packages guarantee tee times.' },
      { day: 3, time: '9:00 AM', course: 'Erin Hills', fee: { low: 435, high: 555, asOf: '2027 rates', verified: true, note: '$555 May 28–Sept 26; $435 May 3–16 and Sept 27–Oct 16.' }, access: 'Walking only, no push carts. Optional caddie $65 plus suggested $75+ tip.', url: 'https://erinhills.com/golf/rates-fees/' },
      { day: 4, time: '8:00 AM', course: 'Whistling Straits (Irish)', fee: { low: 380, high: 380, asOf: '2025 peak rate', verified: true }, access: 'Carts allowed (about $45).' },
    ],
    lodging: { note: 'The American Club in Kohler, or a rental house in Sheboygan or Elkhart Lake split by the group. Erin Hills also has on-site cottages and lodges.', perNight: { low: 90, high: 200, asOf: 'estimate', verified: false } },
    tips: [
      'Book the Straits first and build the rest of the trip around that tee time.',
      'Budget for caddies: the Straits requires one, and Erin Hills is walking only.',
      'Erin Hills offers resort guests a discounted second round in May and October.',
      'Tour operators sell 5-night, 4-round Kohler packages from about $2,335 per person in October (shared room, no flights).',
    ],
    sources: [
      { label: 'Erin Hills: 2027 rates and fees', url: 'https://erinhills.com/golf/rates-fees/' },
      { label: 'CaddieHQ: what it costs to play Whistling Straits (2025)', url: 'https://www.caddiehq.com/resources/what-does-it-cost-to-play-whistling-straits-golf-course' },
      { label: 'Premier Golf: Kohler packages', url: 'https://www.premiergolf.com/kohler-golf-course' },
    ],
  },
  {
    slug: 'sand-valley',
    name: 'Sand Valley',
    state: 'Wisconsin',
    destination: 'Nekoosa, WI',
    airports: ['CWA', 'MSN'],
    airportNote: 'Central Wisconsin (CWA) is about an hour away; Madison (MSN) is about 100 miles. Many Chicago and Minneapolis groups drive.',
    nights: 3,
    bestMonths: 'Late April to mid-October (peak late May–early October)',
    tagline: 'Sand-dune golf in the middle of Wisconsin. Stay on site and play all day.',
    summary: 'Mammoth Dunes and Sand Valley are two of the most fun public courses in the country, with Sedge Valley, the 12-hole Commons and the Sandbox par 3 for replays. Everything is on one property, so the group never needs a car after check-in.',
    rounds: [
      { day: 1, time: '2:00 PM', course: 'The Commons (Sand Valley)', mapAs: 'Sand Valley Golf Resort', fee: { low: 110, high: 150, asOf: '2026 rates', verified: true, note: '12 holes, opened 2026.' } },
      { day: 2, time: '8:00 AM', course: 'Mammoth Dunes', mapAs: 'Sand Valley Golf Resort', fee: { low: 235, high: 325, asOf: '2026 rates', verified: true, note: '$325 peak; $235 Apr 28–May 20 and Oct 5–18.' }, access: 'Caddies $100 per bag plus tip; push carts $10.', url: 'https://sandvalley.com/' },
      { day: 3, time: '8:00 AM', course: 'Sand Valley', mapAs: 'Sand Valley Golf Resort', fee: { low: 235, high: 325, asOf: '2026 rates', verified: true }, access: 'Caddies $100 per bag plus tip; push carts $10.', url: 'https://sandvalley.com/' },
      { day: 4, time: '8:00 AM', course: 'Sedge Valley', mapAs: 'Sand Valley Golf Resort', fee: { low: 150, high: 235, asOf: 'estimate', verified: false }, url: 'https://sandvalley.com/' },
    ],
    lodging: { note: 'On-site rooms, casitas and cottages. The 8-bed Lake Leopold Cottage works well for a foursome-of-foursomes.', perNight: { low: 250, high: 325, asOf: '2025 posted rates', verified: true, note: '8-bed cottage $1,760–2,280 a night plus 13.5% tax, split 8 ways.' } },
    tips: [
      'The Lido is only open to resort guests, Sunday through Thursday, with limited tee times.',
      'Book caddies at least a week ahead.',
      'Play the Sandbox par 3 in the evening; it’s the best $65–85 at the resort.',
      'Prime summer dates sell out early. Sign up for Sand Valley’s newsletter to hear when booking opens.',
    ],
    sources: [
      { label: 'Midwestern Golf: Sand Valley 2026 rates', url: 'https://midwesterngolf.com/2026/07/31/wisconsins-sand-valley-golf-resort-best-golf-resort-in-the-midwest/' },
      { label: 'Sand Valley: FAQ (Lido access, caddies)', url: 'https://sandvalley.com/wi-golf-resort/faq' },
      { label: 'Sand Valley: lodging rates', url: 'https://sandvalley.com/lodging-rates' },
    ],
  },
  {
    slug: 'northern-michigan',
    name: 'Northern Michigan',
    state: 'Michigan',
    destination: 'Traverse City, MI',
    airports: ['TVC'],
    airportNote: 'Traverse City (TVC). Arcadia Bluffs is about an hour southwest; Forest Dunes is about 1 hour 40 minutes east.',
    nights: 3,
    bestMonths: 'June to early October',
    tagline: 'Cliff-top links on Lake Michigan and two courses in the north woods.',
    summary: 'Arcadia Bluffs sits high above Lake Michigan, and its South course is a throwback to old-style golf. Finish at Forest Dunes, where The Loop plays a different direction every day.',
    rounds: [
      { day: 1, time: '2:00 PM', course: 'Arcadia Bluffs (South)', fee: { low: 100, high: 185, asOf: '2026 rates', verified: true, note: '$185 June 1–Oct 4. Includes cart.' }, url: 'https://arcadiabluffs.com/' },
      { day: 2, time: '8:00 AM', course: 'Arcadia Bluffs (Bluffs)', fee: { low: 135, high: 285, asOf: '2026 rates', verified: true, note: '$285 June 1–Oct 4. Includes cart.' }, access: 'Caddies $100 per bag plus tip, on request.', url: 'https://arcadiabluffs.com/' },
      { day: 3, time: '9:00 AM', course: 'Forest Dunes', fee: { low: 160, high: 230, asOf: '2027 rates', verified: true, note: 'Peak $200 Mon–Wed, $230 Thu–Sun. Carts $30.' }, url: 'https://forestdunesgolf.com/' },
      { day: 4, time: '8:00 AM', course: 'The Loop (Forest Dunes)', fee: { low: 160, high: 230, asOf: '2027 rates', verified: true }, access: 'Reversible: the routing switches between even and odd calendar dates.', url: 'https://forestdunesgolf.com/' },
    ],
    lodging: { note: 'A rental house near Arcadia for two nights, then Forest Dunes’ on-site lodge, or a house in Traverse City.', perNight: { low: 75, high: 175, asOf: 'estimate', verified: false } },
    tips: [
      'Forest Dunes has a cheap same-day replay ($100–115 in summer). Book an afternoon round when you get there.',
      'Arcadia Bluffs’ late twilight (after 6 pm) was $125 in 2025, and northern Michigan summer light lasts past 9 pm.',
      'Plan the drive: the two resorts are about two hours apart.',
    ],
    sources: [
      { label: 'Arcadia Bluffs: 2026 rates', url: 'https://arcadiabluffs.com/the-bluffs/rates' },
      { label: 'Forest Dunes: greens fee rates', url: 'https://forestdunesgolf.com/greens-fee-rates' },
    ],
  },
  {
    slug: 'pinehurst',
    name: 'Pinehurst & the Sandhills',
    state: 'North Carolina',
    destination: 'Pinehurst, NC',
    airports: ['RDU', 'FAY'],
    airportNote: 'Raleigh-Durham (RDU) is about 1 hour 15 minutes away, with the most flights. Fayetteville (FAY) is about an hour.',
    nights: 3,
    bestMonths: 'March to May and September to November',
    tagline: 'The home of American golf: classic Donald Ross courses within a few miles of each other.',
    summary: 'This version uses the great public courses around Pinehurst: Pine Needles, Mid Pines and Tobacco Road. To play Pinehurst No. 2 you have to stay at Pinehurst Resort (see the tips).',
    rounds: [
      { day: 1, time: '1:00 PM', course: 'Tobacco Road Golf Club', fee: { low: 320, high: 320, asOf: 'spring 2026', verified: true } },
      { day: 2, time: '8:30 AM', course: 'Pine Needles', fee: { low: 335, high: 335, asOf: 'spring 2026', verified: true } },
      { day: 3, time: '8:30 AM', course: 'Mid Pines Inn & Golf Club', fee: { low: 195, high: 285, asOf: '2025–2026', verified: true, note: '$285 spring 2026; $195 on an August 2025 weekend.' } },
      { day: 4, time: '8:00 AM', course: 'Mid South Club', fee: { low: 250, high: 250, asOf: 'spring 2026', verified: true } },
    ],
    lodging: { note: 'A rental house in Pinehurst village or Southern Pines; Pine Needles and Mid Pines also have their own inns.', perNight: { low: 80, high: 180, asOf: 'estimate', verified: false } },
    tips: [
      'Pinehurst No. 2 and most resort courses (No. 4, 6–10) are for Pinehurst Resort guests only. Resort packages with all ten courses start around $1,640 per person in fall 2027 and $780 in winter.',
      'Pine Needles and Mid Pines are sister courses; ask about playing both.',
      'Spring and fall fill up early. Book tee times 3–6 months out.',
      'The Thistle Dhu putting course at Pinehurst Resort is free to play, and The Deuce bar is next to it.',
    ],
    sources: [
      { label: 'Coastal Golfaway: Pinehurst vs. Myrtle Beach, 2026 pricing', url: 'https://coastalgolfaway.com/blog/pinehurst-vs-myrtle-beach-an-honest-golf-trip-comparison-2026-pricing/' },
      { label: 'GOLF.com: Pinehurst green fees, every course', url: 'https://golf.com/travel/pinehurst-greens-fees-price-every-course/' },
      { label: 'Visit Pinehurst: resort golf packages', url: 'https://homeofgolf.com/packages-deals/' },
      { label: 'Two Down Press: Pinehurst on a budget (2025)', url: 'https://www.twodownpressgolf.com/p/pinehurst-on-a-budget-350' },
    ],
  },
  {
    slug: 'myrtle-beach',
    name: 'Myrtle Beach',
    state: 'South Carolina',
    destination: 'Myrtle Beach, SC',
    airports: ['MYR'],
    airportNote: 'Myrtle Beach (MYR) is 10–30 minutes from most courses.',
    nights: 3,
    bestMonths: 'March to May and October to November (summer is cheapest but hot)',
    tagline: 'The classic buddies trip: lots of golf, a beach house, and fees for every budget.',
    summary: 'Four rounds on the Grand Strand’s favorites, from Pawleys Island to North Myrtle. Swap in the Dunes Club (about $400) for a splurge, or add afternoon replays for 36-hole days.',
    rounds: [
      { day: 1, time: '1:00 PM', course: 'True Blue Golf Club', fee: { low: 109, high: 200, asOf: '2026–2027', verified: true, note: 'About $200 in spring 2026; from $109 in summer 2027.' }, url: 'https://www.truebluegolf.com/' },
      { day: 2, time: '8:30 AM', course: 'Caledonia Golf & Fish Club', fee: { low: 129, high: 250, asOf: '2026–2027', verified: true, note: 'About $250 in spring 2026; from $129 in summer 2027.' } },
      { day: 3, time: '8:00 AM', course: 'TPC Myrtle Beach', fee: { low: 220, high: 220, asOf: 'spring 2026', verified: true } },
      { day: 4, time: '8:00 AM', course: 'Barefoot Resort (Dye Course)', fee: { low: 250, high: 250, asOf: 'spring 2026', verified: true } },
    ],
    lodging: { note: 'A beach house or golf condo. Groups usually spend $250–450 per person for three nights.', perNight: { low: 85, high: 150, asOf: 'spring 2026', verified: true } },
    tips: [
      'Caledonia and True Blue are sister courses with a two-round deal if you play both within 7 days.',
      'Spring dates (especially March and April) book up first. Fees drop sharply in summer.',
      'A mid-tier 3-night, 4-round trip usually runs $950–1,600 per person before flights.',
    ],
    sources: [
      { label: 'Coastal Golfaway: 2026 Myrtle Beach pricing', url: 'https://coastalgolfaway.com/blog/pinehurst-vs-myrtle-beach-an-honest-golf-trip-comparison-2026-pricing/' },
      { label: 'True Blue & Caledonia: rates', url: 'https://www.truebluegolf.com/rates-specials/' },
    ],
  },
  {
    slug: 'scottsdale',
    name: 'Scottsdale',
    state: 'Arizona',
    destination: 'Scottsdale, AZ',
    airports: ['PHX'],
    airportNote: 'Phoenix Sky Harbor (PHX) is 20–40 minutes from the courses, with nonstops from almost everywhere.',
    nights: 3,
    bestMonths: 'January to April (avoid mid-September to October overseeding)',
    tagline: 'Desert golf, guaranteed sunshine, and the 16th hole at TPC.',
    summary: 'Play the Stadium Course where the WM Phoenix Open is held, Troon North and both courses at We-Ko-Pa, with a pool house in North Scottsdale to come back to.',
    rounds: [
      { day: 1, time: '1:00 PM', course: 'We-Ko-Pa (Saguaro)', fee: { low: 150, high: 300, asOf: 'estimate', verified: false }, url: 'https://wekopa.com/' },
      { day: 2, time: '8:00 AM', course: 'TPC Scottsdale (Stadium)', fee: { low: 303, high: 550, asOf: '2026 rates', verified: true, note: '$436–550 in peak season; about $303–319 from May.' } },
      { day: 3, time: '8:00 AM', course: 'Troon North (Monument)', fee: { low: 150, high: 375, asOf: 'estimate', verified: false } },
      { day: 4, time: '7:30 AM', course: 'We-Ko-Pa (Cholla)', fee: { low: 150, high: 300, asOf: 'estimate', verified: false }, url: 'https://wekopa.com/' },
    ],
    lodging: { note: 'A large rental home with a pool in North Scottsdale usually beats several resort rooms for a group.', perNight: { low: 100, high: 225, asOf: 'estimate', verified: false } },
    tips: [
      'The 2027 WM Phoenix Open is the week of February 8. Both TPC courses close to the public for about 10 days around it.',
      'Most courses overseed from mid-September to mid-October, closing for 2–3 weeks.',
      'Book January–April tee times 60–90 days ahead.',
      'Afternoon tee times are much cheaper, and in summer, early mornings are the only comfortable option.',
    ],
    sources: [
      { label: 'The Golf News Net: TPC Scottsdale cost in 2026', url: 'https://thegolfnewsnet.com/golfnewsnetteam/2026/02/03/how-much-does-it-cost-to-play-golf-at-tpc-scottsdale-in-2026-140439/' },
      { label: 'Stay Porter: Scottsdale golf trip guide (Sept 2026)', url: 'https://www.stayporter.com/blog/scottsdale-golf-trip/' },
    ],
  },
  {
    slug: 'bandon-dunes',
    name: 'Bandon Dunes',
    state: 'Oregon',
    destination: 'Bandon, OR',
    airports: ['OTH', 'EUG', 'PDX'],
    airportNote: 'North Bend (OTH) is 30 minutes away but has few flights. Eugene (EUG) is about 2 hours 45 minutes; Portland (PDX) about 4 hours 30 minutes.',
    nights: 3,
    bestMonths: 'May to October (peak June–September)',
    tagline: 'The ultimate pilgrimage: walking-only links golf on the Oregon coast.',
    summary: 'Five 18-hole courses and two par-3 courses on the cliffs above the Pacific. Stay on site, walk everything, and take the half-price replay rounds when your legs allow.',
    rounds: [
      { day: 1, time: '3:00 PM', course: 'Bandon Preserve', fee: { low: 90, high: 125, asOf: '2026–2027 rates', verified: true, note: '13-hole par 3. Proceeds go to charity.' }, url: 'https://bandondunesgolf.com/' },
      { day: 2, time: '8:00 AM', course: 'Pacific Dunes', mapAs: 'Bandon Dunes Golf Resort', fee: { low: 210, high: 370, asOf: '2026–2027 resort guest rates', verified: true, note: '$350–370 June–Sept; $210–325 in April, May and October.' }, access: 'Walking only. Non-guests pay about $45–50 more, and more again for times booked over 21 days ahead.', url: 'https://bandondunesgolf.com/' },
      { day: 3, time: '8:00 AM', course: 'Bandon Dunes', fee: { low: 210, high: 370, asOf: '2026–2027 resort guest rates', verified: true }, access: 'Walking only.', url: 'https://bandondunesgolf.com/' },
      { day: 4, time: '8:00 AM', course: 'Sheep Ranch', fee: { low: 210, high: 370, asOf: '2026–2027 resort guest rates', verified: true }, access: 'Walking only.', url: 'https://bandondunesgolf.com/' },
    ],
    lodging: { note: 'Stay at the resort for lower green fees and better tee times.', perNight: { low: 150, high: 325, asOf: 'estimate', verified: false } },
    tips: [
      'A second round on the same day (replay) is about half price. Old Macdonald and Bandon Trails make great afternoon replays.',
      'Day guests can play, but April to mid-November tee times booked more than 21 days ahead cost a premium and must be after 10 am.',
      'Caddies are popular; ask for them when you book tee times.',
      'Bring rain gear in every month.',
    ],
    sources: [
      { label: 'Bandon Dunes: course rates', url: 'https://bandondunesgolf.com/' },
    ],
  },
  {
    slug: 'rtj-golf-trail',
    name: 'Robert Trent Jones Golf Trail',
    state: 'Alabama',
    destination: 'Birmingham, AL',
    airports: ['BHM', 'ATL'],
    airportNote: 'Fly into Birmingham (BHM) and home from Atlanta (ATL). Grand National is about 1 hour 30 minutes from ATL.',
    nights: 3,
    bestMonths: 'March to May and September to November',
    tagline: 'The best value in golf: championship public courses for a fraction of resort prices.',
    summary: 'A road trip across Alabama’s state-run golf trail: Oxmoor Valley and Ross Bridge in Birmingham, Capitol Hill near Montgomery, and Grand National in Auburn–Opelika. Package rates include the cart.',
    rounds: [
      { day: 1, time: '1:00 PM', course: 'Oxmoor Valley (Ridge)', fee: { low: 115, high: 115, asOf: 'fall 2026 package', verified: true, note: 'Per day with cart, 2+ day RTJ package.' }, url: 'https://www.rtjgolf.com/' },
      { day: 2, time: '8:30 AM', course: 'Ross Bridge', fee: { low: 190, high: 190, asOf: 'fall 2026 package', verified: true }, url: 'https://www.rtjgolf.com/' },
      { day: 3, time: '8:30 AM', course: 'Capitol Hill (Judge)', mapAs: 'Montgomery Marriott Prattville Hotel', fee: { low: 130, high: 130, asOf: 'fall 2026 package', verified: true, note: 'Includes the $15 Judge surcharge.' }, url: 'https://www.rtjgolf.com/' },
      { day: 4, time: '8:00 AM', course: 'Grand National (Lake)', fee: { low: 115, high: 115, asOf: 'fall 2026 package', verified: true }, url: 'https://www.rtjgolf.com/' },
    ],
    lodging: { note: 'Several Trail sites have hotels right on the course (like the Renaissance at Ross Bridge). Two to a room keeps it cheap.', perNight: { low: 75, high: 175, asOf: 'estimate', verified: false } },
    tips: [
      'Book through RTJ reservations (1-800-949-4444) for package rates; packages can’t be combined with Trail Card discounts.',
      'The Fall Unlimited package ($155+/day) lets you play as many rounds as you want each day.',
      'Add Magnolia Grove in Mobile or Lakewood Club at the Grand Hotel for a longer trip.',
    ],
    sources: [
      { label: 'RTJ Golf Trail: fall 2026 packages', url: 'https://www.rtjgolf.com/fall/' },
      { label: 'RTJ Golf Trail: reservations', url: 'https://www.rtjgolf.com/reservations/' },
    ],
  },
];

export const templateBySlug = (slug: string) => TEMPLATES.find((t) => t.slug === slug) || null;

/** Estimated cost per golfer, before flights: golf + lodging + food. */
export function templateCost(t: TripTemplate, nights = t.nights) {
  const golf = t.rounds.reduce((s, r) => [s[0] + r.fee.low, s[1] + r.fee.high], [0, 0]);
  const stay = [t.lodging.perNight.low * nights, t.lodging.perNight.high * nights];
  const food = [FOOD_PER_DAY[0] * (nights + 1), FOOD_PER_DAY[1] * (nights + 1)];
  const round50 = (n: number) => Math.round(n / 50) * 50;
  return {
    golf: golf as [number, number],
    stay: stay as [number, number],
    food: food as [number, number],
    total: [round50(golf[0] + stay[0] + food[0]), round50(golf[1] + stay[1] + food[1])] as [number, number],
  };
}

/** A typical fee to start the vote with: the middle of the range, rounded to $5. */
export const typicalFee = (f: TemplateFee) => Math.round((f.low + f.high) / 2 / 5) * 5;
