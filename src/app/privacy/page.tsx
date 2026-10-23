import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy · Foresome' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="October 23, 2026">
      <p>Foresome helps groups plan golf trips. This page explains what we collect, why, who we share it with, and how to delete it. Questions: <strong>privacy@foresomes.net</strong>.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>What you tell us:</strong> your name, home city and home airport, your trip budget, and whether you’ll share a bed. If you create an account: your email address and, if you add it, your phone number.</li>
        <li><strong>What you add to trips:</strong> suggested dates, destinations, places to stay, rounds of golf and greens fees, your votes, and flight details you pick or enter.</li>
        <li><strong>Technical data:</strong> a random code saved on your phone that keeps you signed in to a trip or account, and, if you turn on notifications, the address your phone provides for delivering them. To prevent abuse we keep a scrambled (hashed) version of your IP address for up to a day; we don’t store the IP itself.</li>
      </ul>
      <p>We don’t use advertising trackers or sell your information.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>People on your trip</strong> see your name, home airport, budget, bed preference, votes, and flight details. People who only have the invite link and haven’t joined see the trip name, the organizer’s first name, and how many people are going.</li>
        <li><strong>Greens fees</strong> you enter are shared with other Foresome groups as anonymous price ranges for that course (no names, trips or dates).</li>
      </ul>

      <h2>Services we use</h2>
      <p>These companies process data for us only to run Foresome:</p>
      <ul>
        <li><strong>Supabase</strong>: database and sign-in.</li>
        <li><strong>Vercel</strong>: hosting.</li>
        <li><strong>Resend</strong>: sign-in codes and trip reminder emails.</li>
        <li><strong>Duffel</strong>: flight search (receives your home airport, destination airport and dates when you search).</li>
        <li><strong>National Weather Service</strong>, <strong>NOAA</strong>, <strong>NASA POWER</strong>, <strong>OpenStreetMap</strong>, <strong>OpenGolfAPI</strong> and <strong>Google Maps</strong>: weather, maps, place and golf course lookups and course ratings (receive the destination’s location, never who you are).</li>
        <li><strong>Apple, Google or Mozilla</strong> push services: delivering notifications you turned on.</li>
      </ul>
      <p>Links to Airbnb, Vrbo, Booking.com, Expedia, Google, airlines and golf courses take you to their sites, where their own privacy policies apply.</p>

      <h2>Emails and notifications</h2>
      <p>If you have an account, we email you sign-in codes and, unless you turn them off in your profile, trip updates such as reminders to vote and the final plan. Notifications on your phone are only sent if you turn them on, and you can turn them off on the trip’s Clubhouse tab.</p>

      <h2>Keeping and deleting your data</h2>
      <ul>
        <li>Delete your account any time from your profile. That removes your profile, your sign-in, and your spot and votes on every trip.</li>
        <li>Leaving a trip removes your spot and votes on it. An organizer deleting a trip removes everything on it.</li>
        <li>Unused sign-ins expire after six months, and sign-in requests after a day.</li>
      </ul>

      <h2>Children</h2>
      <p>Foresome isn’t meant for children under 13, and we don’t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we’ll update the date above and, for significant changes, tell account holders by email.</p>
    </LegalPage>
  );
}
