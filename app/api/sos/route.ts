import { NextResponse } from 'next/server';

// In-memory store for the latest SOS coordinates
// This persists across requests as long as the server is running
interface SOSData {
  lat: number;
  lon: number;
  timestamp: number;
}

// Use globalThis to persist across hot reloads in development
const globalStore = globalThis as unknown as { __sosData?: SOSData | null };
if (!globalStore.__sosData) {
  globalStore.__sosData = null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lon } = body;

    // Validate the incoming data
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json(
        { error: 'Invalid data. Expected { lat: number, lon: number }' },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { error: 'Coordinates out of range.' },
        { status: 400 }
      );
    }

    // Store the latest SOS data
    globalStore.__sosData = {
      lat,
      lon,
      timestamp: Date.now(),
    };

    console.log(`[SOS RECEIVED] lat: ${lat}, lon: ${lon} at ${new Date().toISOString()}`);

    return NextResponse.json(
      { success: true, message: 'SOS received', data: globalStore.__sosData },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
}

// Also support GET for testing — shows if any SOS is stored
export async function GET() {
  return NextResponse.json({
    hasSOS: !!globalStore.__sosData,
    data: globalStore.__sosData,
  });
}
