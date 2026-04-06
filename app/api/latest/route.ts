import { NextResponse } from 'next/server';

// Access the same global store used by the SOS endpoint
interface SOSData {
  lat: number;
  lon: number;
  timestamp: number;
}

const globalStore = globalThis as unknown as { __sosData?: SOSData | null };

export async function GET() {
  const data = globalStore.__sosData || null;

  return NextResponse.json({
    hasSOS: !!data,
    data,
  });
}
