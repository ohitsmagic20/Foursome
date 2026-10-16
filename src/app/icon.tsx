import { ImageResponse } from 'next/og';
import { FlagMark } from '@/lib/iconMark';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<FlagMark s={512} />, size);
}
