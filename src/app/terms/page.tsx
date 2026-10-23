import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms · Foresome' };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="October 23, 2026">
      <p>By using Foresome you agree to these terms. If you don’t agree, please don’t use it. Questions: <strong>support@foresomes.net</strong>.</p>

      <h2>What Foresome is</h2>
      <p>Foresome is a planning tool. It helps a group vote on dates, a destination, a place to stay and rounds of golf, and shows each person an estimated cost. <strong>Foresome doesn’t book or sell anything.</strong> Flights, lodging and tee times are booked directly with the airline, rental site, hotel or golf course, under their terms and prices.</p>

      <h2>Prices and information are estimates</h2>
      <p>Flight prices, greens fees (including ranges other groups entered), weather, course lists and airport suggestions come from third parties or other users and can be wrong or out of date. Always confirm prices, availability and details with the seller before you book or pay. Cost splits in the app are estimates for planning; how your group actually pays is up to you.</p>

      <h2>Your account and trips</h2>
      <ul>
        <li>Keep your sign-in codes and invite links to yourself; anyone with a trip’s invite link can join it.</li>
        <li>Trip organizers can lock decisions, remove people and delete the trip.</li>
        <li>You’re responsible for what you add, including links and prices. Don’t add anything illegal, abusive, or that you don’t have the right to share.</li>
      </ul>

      <h2>Fair use</h2>
      <p>Don’t misuse Foresome: no spamming, automated scraping, attempts to access other people’s trips, or interfering with the service. We may limit or remove access for misuse.</p>

      <h2>Availability</h2>
      <p>Foresome is provided “as is.” We work to keep it running and accurate but can’t promise it will always be available or error-free, and we may change or discontinue features.</p>

      <h2>Limitation of liability</h2>
      <p>To the extent the law allows, Foresome isn’t liable for losses from relying on information in the app, from bookings made with third parties, or from the service being unavailable.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If changes are significant, we’ll update the date above and let account holders know. Continuing to use Foresome after that means you accept the updated terms.</p>
    </LegalPage>
  );
}
