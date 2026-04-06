import { NextResponse } from 'next/server';

let latest: { lat: number | null; lon: number | null; time: Date | null } = {
  lat: null,
  lon: null,
  time: null
};

// Global object to persist data across HMR in dev and some serverless executions
const globalStore = globalThis as unknown as { __sosData?: typeof latest };
if (!globalStore.__sosData) {
  globalStore.__sosData = latest;
}

export async function POST(request: Request) {
  try {
    const { lat, lon } = await request.json();

    globalStore.__sosData = {
      lat,
      lon,
      time: new Date()
    };

    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(globalStore.__sosData, { status: 200 });
}
