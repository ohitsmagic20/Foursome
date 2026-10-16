import { ImageResponse } from 'next/og';
import { FlagMark } from '@/lib/iconMark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iPhone home screen icon.
export default function AppleIcon() {
  return new ImageResponse(<FlagMark s={180} />, size);
}
