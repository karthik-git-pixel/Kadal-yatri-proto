import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    if (!lat || !lon) return NextResponse.json({ error: 'missing coordinates' }, { status: 400 });

    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return NextResponse.json({ error: 'server missing api key' }, { status: 500 });

    // Fetch current weather
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${key}&units=metric&lang=ml`;
    const weatherResp = await fetch(weatherUrl);
    const weatherData = await weatherResp.json();

    if (!weatherResp.ok) {
      return NextResponse.json({ error: weatherData?.message || 'weather fetch failed' }, { status: weatherResp.status });
    }

    return NextResponse.json(weatherData, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
