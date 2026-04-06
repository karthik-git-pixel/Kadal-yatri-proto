import { NextResponse } from 'next/server';

// Global store to hold the latest ESP32 SOS coordinates
// Variables in globalThis persist between hot reloads and short-lived Vercel serverless requests
const globalStore = globalThis as unknown as { 
  __sosData?: { lat: number; lon: number; time: string } | null 
};

if (!globalStore.__sosData) {
  globalStore.__sosData = null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lon } = body;

    if (lat === undefined || lon === undefined) {
      return NextResponse.json({ error: "Missing lat or lon" }, { status: 400 });
    }

    // Save ESP32 coordinates to memory
    globalStore.__sosData = {
      lat: Number(lat),
      lon: Number(lon),
      time: new Date().toISOString()
    };

    console.log(`[ESP32 SOS RECEIVED] Lat: ${lat}, Lon: ${lon}`);

    return NextResponse.json({ status: "received", data: globalStore.__sosData }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  if (!globalStore.__sosData) {
    // Return empty if no SOS has been active yet
    return NextResponse.json({ lat: null, lon: null, time: null }, { status: 200 });
  }
  
  // Return the latest coordinates
  return NextResponse.json(globalStore.__sosData, { status: 200 });
}
