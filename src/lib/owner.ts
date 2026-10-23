import 'server-only';

/** The app owner(s), by account email: OWNER_EMAIL in the server settings (comma-separated for more than one). */
export function isOwner(email: string | undefined | null): boolean {
  const owners = (process.env.OWNER_EMAIL || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && owners.includes(email.trim().toLowerCase());
}
export const ownerEmails = () => (process.env.OWNER_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
