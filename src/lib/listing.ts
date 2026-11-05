/** Details read from a rental or hotel page's share tags. Anything not found is 0 or ''. */
export interface ListingFacts { name: string; bedrooms: number; beds: number; sleeps: number; rating: number }

const num = (re: RegExp, s: string) => { const m = s.match(re); return m ? Number(m[1]) : 0; };

/**
 * Airbnb: og:title "Home in Myrtle Beach · ★4.92 · 4 bedrooms · 6 beds · 3 baths", og:description = the listing's own title.
 * Vrbo and others: "Oceanfront 5BR Home | Sleeps 12 - Myrtle Beach Vacation Rental".
 */
export function parseListing(title: string, description = '', site = ''): ListingFacts {
  const t = title.replace(/\s+/g, ' ').trim();
  const d = description.replace(/\s+/g, ' ').trim();
  const all = `${t} · ${d}`;
  const bedrooms = num(/(\d+)\s*(?:bedrooms?\b|BR\b|bdrm?s?\b|-bedroom)/i, all);
  const beds = num(/(\d+)\s*beds?\b(?!room)/i, all);
  const sleeps = num(/sleeps\s*(\d+)/i, all) || num(/(\d+)\s*guests?\b/i, all);
  const rating = num(/★\s*([0-9.]+)/, all) || num(/([0-9]\.[0-9]{1,2})\s*(?:out of 5|\/\s*5)/i, all);

  let name = t;
  // Airbnb's title is a summary ("Home in X · ★4.9 · …"); its description is the listing's real name.
  const summary = /^[^·]{2,60}\bin\b[^·]+·/.test(t);
  if (summary) name = d && d.length <= 90 && !/^\d/.test(d) ? d : t.split('·')[0].trim();
  // Drop site suffixes: " - Airbnb", " | Vrbo", " - Myrtle Beach Vacation Rental".
  name = name
    .replace(/\s*[-|–]\s*(Airbnb|Vrbo|HomeAway|Booking\.com|Expedia|Hotels\.com|Tripadvisor)\b.*$/i, '')
    .replace(/\s*[-|–]\s*[^-|–]*\b(Vacation Rental|Holiday Rental)s?\b.*$/i, '')
    .replace(/^(Airbnb|Vrbo)\s*[:|-]\s*/i, '')
    .trim();
  if (site && name.toLowerCase() === site.toLowerCase()) name = '';
  return { name: name.slice(0, 80), bedrooms, beds, sleeps, rating };
}
