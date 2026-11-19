import { describe, expect, it } from 'vitest';
import { airlineSite, carSearchUrl, listingSite } from '@/lib/shared';

describe('book on the real site', () => {
  it('links a picked flight to its airline', () => {
    expect(airlineSite('Delta Air Lines · ORD→PHX · nonstop out')?.name).toBe('Delta');
    expect(airlineSite('Southwest Airlines · MDW→PHX')?.url).toMatch(/southwest\.com/);
    expect(airlineSite('Lufthansa · FRA→PHX')).toBeNull();
    expect(airlineSite(null)).toBeNull();
  });
  it('names where a stay is booked', () => {
    expect(listingSite('https://www.airbnb.com/rooms/123')).toBe('Airbnb');
    expect(listingSite('https://www.vrbo.com/456')).toBe('Vrbo');
    expect(listingSite('https://www.marriott.com/x')).toBe('their site');
    expect(listingSite(undefined)).toBe('');
  });
  it('searches cars at the airport for the trip dates', () => {
    expect(carSearchUrl('PHX', '2027-03-11', 4)).toBe('https://www.kayak.com/cars/PHX/2027-03-11/2027-03-15?sort=price_a');
  });
});
