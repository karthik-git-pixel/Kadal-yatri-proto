import { NextResponse } from 'next/server';

// In-memory store (will reset on Vercel cold starts, 
// and may not synchronize perfectly between multiple serverless function instances, 
// but will work for basic prototype purposes)
const globalStore = globalThis as unknown as { 
  __sosData?: { lat: number; lon: number; timestamp: number } | null 
};

if (!globalStore.__sosData) {
  globalStore.__sosData = null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lon } = body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json({ error: 'Expected JSON { lat: number, lon: number }' }, { status: 400 });
    }

    // Save to global memory
    globalStore.__sosData = {
      lat,
      lon,
      timestamp: Date.now(),
    };

    console.log(`[SOS] Received lat ${lat}, lon ${lon}`);
    return NextResponse.json({ success: true, status: 'received', data: globalStore.__sosData }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    hasSOS: !!globalStore.__sosData,
    data: globalStore.__sosData,
  });
}
