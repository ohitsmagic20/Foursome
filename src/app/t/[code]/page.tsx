import TripApp from '@/components/TripApp';

export default async function TripPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TripApp code={code} />;
}
