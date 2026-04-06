'use client';

import { useSimulation } from '@/lib/simulation';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useRef, useCallback } from 'react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

// Component to re-center the map when ESP32 SOS arrives
const MapFlyTo = dynamic(() => import('react-leaflet').then(mod => {
  const { useMap } = mod;
  const FlyToComponent = ({ position }: { position: [number, number] | null }) => {
    const map = useMap();
    useEffect(() => {
      if (position) {
        map.flyTo(position, 14, { duration: 1.5 });
      }
    }, [position, map]);
    return null;
  };
  return { default: FlyToComponent };
}), { ssr: false });

interface ESPSOSData {
  lat: number;
  lon: number;
  timestamp: number;
}

export default function CommandDashboard() {
  const { state, resolveSOS, updateMarketItem, addPFZZone } = useSimulation();
  const { vessels, incoisData, marketData, pfzZones } = state;
  
  const [selectedDashboardMarket, setSelectedDashboardMarket] = useState<string>('Vizhinjam');
  const [L, setL] = useState<any>(null);

  const [newFish, setNewFish] = useState({ species: '', malayalam: '', port: '', price: '' });
  const [newPFZ, setNewPFZ] = useState({ lat: '', lng: '', name: '' });

  // ESP32 SOS state
  const [espSOS, setEspSOS] = useState<ESPSOSData | null>(null);
  const [sosBannerVisible, setSosBannerVisible] = useState(false);
  const [flyToPos, setFlyToPos] = useState<[number, number] | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const sosSoundRef = useRef<HTMLAudioElement | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markets = Array.from(new Set(marketData.map(m => m.port)));
  const filteredMarket = marketData.filter(m => m.port === selectedDashboardMarket);

  // Load Leaflet
  useEffect(() => {
    import('leaflet').then(mod => {
      const DefaultIcon = mod.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });
      mod.Marker.prototype.options.icon = DefaultIcon;
      setL(mod);
    });
  }, []);

  // Create SOS alert sound (generated beep via Web Audio API)
  const playSOSBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 660;
        osc2.type = 'square';
        gain2.gain.value = 0.15;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 350);
    } catch {
      // ignore if Web Audio not supported
    }
  }, []);

  // Poll /api/latest every 2 seconds for ESP32 data
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/latest', { cache: 'no-store' });
        const json = await res.json();
        if (json.hasSOS && json.data) {
          const incoming: ESPSOSData = json.data;
          // Only trigger alert if this is new data
          if (incoming.timestamp > lastTimestampRef.current) {
            lastTimestampRef.current = incoming.timestamp;
            setEspSOS(incoming);
            
            // Show SOS banner
            setSosBannerVisible(true);
            playSOSBeep();
            
            // Fly to the SOS location
            setFlyToPos([incoming.lat, incoming.lon]);

            // Auto-hide banner after 10 seconds
            if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = setTimeout(() => setSosBannerVisible(false), 10000);
          } else {
            // Update position even if same timestamp (e.g., page reload)
            setEspSOS(incoming);
          }
        }
      } catch {
        // silently ignore fetch errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [playSOSBeep]);

  const sosVessels = vessels.filter((v: any) => v.status === 'SOS');
  const coastlinePos: [number, number] = [8.38, 76.95];

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2;
    return (R * 2 * Math.asin(Math.sqrt(a))).toFixed(1);
  };

  const handleUpdateMarket = () => {
    if (newFish.species && newFish.port && newFish.price) {
      updateMarketItem({
        species: newFish.species,
        malayalam: newFish.malayalam || newFish.species,
        port: newFish.port,
        price: parseInt(newFish.price),
        unit: 'kg'
      });
      setNewFish({ species: '', malayalam: '', port: '', price: '' });
    }
  };

  const handleBroadcastPFZ = () => {
    if (newPFZ.lat && newPFZ.lng && newPFZ.name) {
      addPFZZone({
        id: 'pfz' + Date.now(),
        name: newPFZ.name,
        lat: parseFloat(newPFZ.lat),
        lng: parseFloat(newPFZ.lng),
        radius: 2500,
        confidence: 90
      });
      setNewPFZ({ lat: '', lng: '', name: '' });
    }
  };

  const dismissBanner = () => {
    setSosBannerVisible(false);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
  };

  const espSOSAgeSeconds = espSOS ? Math.floor((Date.now() - espSOS.timestamp) / 1000) : null;

  return (
    <>
      <style jsx>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: 350px 1fr 400px;
          height: 100vh;
          padding: 15px;
          gap: 15px;
          background: var(--bg-color);
        }
        .dashboard-left {
          display: flex;
          flex-direction: column;
          gap: 15px;
          overflow-y: auto;
        }
        .dashboard-center {
          position: relative;
          min-height: 0;
        }
        .dashboard-right {
          display: flex;
          flex-direction: column;
          gap: 15px;
          overflow-y: auto;
        }
        .map-wrapper {
          height: 100%;
          padding: 0;
          overflow: hidden;
          border: 1px solid var(--accent-blue-glow);
        }
        .weather-overlay {
          position: absolute;
          bottom: 25px;
          left: 25px;
          z-index: 1000;
          display: flex;
          gap: 15px;
        }

        /* ===== SOS ALERT BANNER ===== */
        .sos-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: linear-gradient(135deg, #ff1a1a, #ff4d4d, #ff1a1a);
          background-size: 400% 400%;
          animation: sos-gradient-shift 2s ease infinite, sos-slide-down 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: white;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 30px rgba(255, 26, 26, 0.6), 0 0 60px rgba(255, 26, 26, 0.3);
          border-bottom: 2px solid rgba(255, 255, 255, 0.3);
        }
        .sos-banner-content {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }
        .sos-banner-icon {
          font-size: 2rem;
          animation: sos-icon-pulse 1s ease-in-out infinite;
        }
        .sos-banner-text h3 {
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(255,255,255,0.5);
        }
        .sos-banner-text p {
          font-size: 0.8rem;
          opacity: 0.9;
          font-family: var(--font-mono);
          margin-top: 2px;
        }
        .sos-banner-dismiss {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: white;
          padding: 8px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .sos-banner-dismiss:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        @keyframes sos-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes sos-slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes sos-icon-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        /* ===== ESP32 SOS CARD ===== */
        .esp-sos-card {
          background: linear-gradient(135deg, rgba(255, 26, 26, 0.15), rgba(255, 77, 77, 0.08));
          border: 1px solid rgba(255, 77, 77, 0.5);
          border-radius: 16px;
          padding: 18px;
          animation: esp-card-glow 2s ease-in-out infinite;
        }
        @keyframes esp-card-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 77, 77, 0.2); }
          50% { box-shadow: 0 0 30px rgba(255, 77, 77, 0.5); }
        }
        .esp-sos-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ff4d4d;
          animation: esp-dot-blink 1s ease-in-out infinite;
          display: inline-block;
        }
        @keyframes esp-dot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 280px 1fr 320px;
            padding: 10px;
            gap: 10px;
          }
        }

        @media (max-width: 900px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
            padding: 10px;
            gap: 12px;
          }
          .dashboard-left {
            order: 2;
          }
          .dashboard-center {
            order: 1;
            min-height: 400px;
            height: 50vh;
          }
          .dashboard-right {
            order: 3;
          }
          .weather-overlay {
            bottom: 10px;
            left: 10px;
            gap: 8px;
            flex-wrap: wrap;
          }
          .sos-banner {
            flex-direction: column;
            gap: 12px;
            text-align: center;
          }
          .sos-banner-content {
            flex-direction: column;
            gap: 8px;
          }
        }

        @media (max-width: 480px) {
          .dashboard-grid {
            padding: 8px;
            gap: 10px;
          }
          .dashboard-center {
            min-height: 300px;
            height: 45vh;
          }
          .weather-overlay {
            bottom: 8px;
            left: 8px;
            gap: 6px;
          }
        }
      `}</style>

      {/* ===== SOS ALERT BANNER ===== */}
      {sosBannerVisible && espSOS && (
        <div className="sos-banner" id="sos-alert-banner">
          <div className="sos-banner-content">
            <div className="sos-banner-icon">🚨</div>
            <div className="sos-banner-text">
            <h3>🚨 SOS ACTIVE</h3>
            <p>ESP32 GPS: {espSOS.lat.toFixed(6)}, {espSOS.lon.toFixed(6)} — {new Date(espSOS.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
          <button className="sos-banner-dismiss" onClick={dismissBanner}>DISMISS</button>
        </div>
      )}

      <div className="dashboard-grid">
      
        {/* LEFT: FLEET STATUS & TELEMETRY */}
        <aside className="dashboard-left">
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(0,210,255,0.05), transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>🛰️ COMMAND</h2>
               <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>V.1.0-STABLE</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '15px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>{vessels.length}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', letterSpacing: '0.1em', fontWeight: 800 }}>TOTAL VESSELS</div>
              </div>
              <div style={{ background: sosVessels.length > 0 ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '15px', border: `1px solid ${sosVessels.length > 0 ? 'var(--accent-orange)' : 'var(--glass-border)'}` }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: sosVessels.length > 0 ? 'var(--accent-orange)' : 'white' }}>{sosVessels.length}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', letterSpacing: '0.1em', fontWeight: 800 }}>MESH SOS</div>
              </div>
              <div style={{ background: espSOS ? 'rgba(255,26,26,0.15)' : 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '15px', border: `1px solid ${espSOS ? '#ff4d4d' : 'var(--glass-border)'}`, transition: 'all 0.3s' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: espSOS ? '#ff4d4d' : 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {espSOS ? '1' : '0'}
                  {espSOS && <span className="esp-sos-dot" />}
                </div>
                <div style={{ fontSize: '0.6rem', color: '#ff4d4d', letterSpacing: '0.1em', fontWeight: 800 }}>ESP32 SOS</div>
              </div>
            </div>
          </div>

          {/* ESP32 SOS DETAIL CARD */}
          {espSOS && (
            <div className="glass-card esp-sos-card" id="esp32-sos-detail">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.8rem', color: '#ff4d4d', fontWeight: 800, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="esp-sos-dot" />
                  ESP32 LIVE SOS
                </h3>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                  {espSOSAgeSeconds !== null && espSOSAgeSeconds < 60 ? `${espSOSAgeSeconds}s ago` : espSOSAgeSeconds !== null ? `${Math.floor(espSOSAgeSeconds / 60)}m ago` : ''}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '4px' }}>LATITUDE</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ff4d4d', fontFamily: 'var(--font-mono)' }}>{espSOS.lat.toFixed(6)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '4px' }}>LONGITUDE</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ff4d4d', fontFamily: 'var(--font-mono)' }}>{espSOS.lon.toFixed(6)}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px' }}>
                📡 Signal: {new Date(espSOS.timestamp).toLocaleString()}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <a
                  href={`https://www.google.com/maps?q=${espSOS.lat},${espSOS.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ff4d4d', border: 'none', color: 'white', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', textDecoration: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
                >
                  📍 OPEN IN MAPS
                </a>
                <button
                  onClick={() => setFlyToPos([espSOS.lat, espSOS.lon])}
                  style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  🎯 FOCUS
                </button>
              </div>
            </div>
          )}

          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '5px' }}>TELEMETRY TRACKING</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {vessels.map((v: any) => (
                 <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', borderLeft: `4px solid ${v.status === 'SOS' ? 'var(--accent-orange)' : 'var(--accent-green)'}`, transition: '0.3s' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                     <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{v.name}</div>
                     <div style={{ color: v.status === 'SOS' ? 'var(--accent-orange)' : 'var(--accent-green)', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em' }}>{v.status.toUpperCase()}</div>
                   </div>
                   <div style={{ display: 'flex', gap: '15px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                     <span>⚡ {Math.floor(v.battery)}%</span>
                     <span>🌊 {v.speed} kn</span>
                     <span>🧭 {v.heading}°</span>
                   </div>
                   {v.status === 'SOS' && (
                     <div style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', fontWeight: 800, marginTop: '5px', background: 'rgba(255,77,77,0.1)', padding: '5px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>📡 ALERT: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</div>
                   )}
                 </div>
               ))}
            </div>
          </div>
        </aside>

        {/* CENTER: SURVEILLANCE MAP */}
        <main className="dashboard-center">
          <div className="glass-card map-wrapper">
            {L && (
              <MapContainer center={[8.35, 76.88]} zoom={11} style={{ height: '100%', width: '100%', filter: 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Circle center={coastlinePos} radius={500} color="var(--accent-blue)" fillColor="var(--accent-blue)" fillOpacity={0.4} />
                
                {/* Fly to ESP32 SOS location */}
                <MapFlyTo position={flyToPos} />

                {pfzZones.map((z: any) => (
                  <Circle key={z.id} center={[z.lat, z.lng]} radius={z.radius} pathOptions={{ color: 'var(--accent-green)', fillColor: 'var(--accent-green)', fillOpacity: 0.2 }} />
                ))}

                {vessels.map((v: any) => (
                  <Marker key={v.id} position={[v.lat, v.lng]}>
                    <Popup>
                      <div style={{ color: 'black', fontFamily: 'var(--font-sans)', padding: '10px' }}>
                         <strong style={{ fontSize: '1.1rem' }}>{v.name}</strong><br/>
                         <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>TELEMETRY: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</div>
                         <button onClick={() => resolveSOS(v.id)} style={{ width: '100%', marginTop: '12px', background: 'var(--accent-blue)', border: 'none', padding: '8px', borderRadius: '6px', color: 'black', fontWeight: 800, cursor: 'pointer' }}>RESOLVE SOS</button>
                      </div>
                    </Popup>
                    {v.status === 'SOS' && <Circle center={[v.lat, v.lng]} radius={1500} pathOptions={{ color: 'red', fillColor: 'red', className: 'sos-pulse' }} />}
                  </Marker>
                ))}
                {sosVessels.map((v: any) => <Polyline key={`mesh-${v.id}`} positions={[[v.lat, v.lng], coastlinePos]} color="orange" dashArray="8, 12" weight={2} />)}

                {/* ===== ESP32 SOS MARKER ===== */}
                {espSOS && (
                  <>
                    <Marker position={[espSOS.lat, espSOS.lon]}>
                      <Popup>
                        <div style={{ color: 'black', fontFamily: 'var(--font-sans)', padding: '10px' }}>
                          <strong style={{ fontSize: '1.1rem', color: '#d32f2f' }}>🚨 ESP32 SOS</strong><br/>
                          <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>LAT: {espSOS.lat.toFixed(6)}</div>
                          <div style={{ fontSize: '0.8rem' }}>LON: {espSOS.lon.toFixed(6)}</div>
                          <div style={{ fontSize: '0.75rem', marginTop: '5px', color: '#666' }}>{new Date(espSOS.timestamp).toLocaleString()}</div>
                          <a
                            href={`https://www.google.com/maps?q=${espSOS.lat},${espSOS.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', width: '100%', marginTop: '10px', background: '#d32f2f', padding: '8px', borderRadius: '6px', color: 'white', fontWeight: 800, textAlign: 'center', textDecoration: 'none' }}
                          >
                            OPEN IN GOOGLE MAPS
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                    {/* Pulsing red circle around ESP32 SOS location */}
                    <Circle
                      center={[espSOS.lat, espSOS.lon]}
                      radius={2000}
                      pathOptions={{
                        color: '#ff1a1a',
                        fillColor: '#ff1a1a',
                        fillOpacity: 0.15,
                        weight: 3,
                        className: 'sos-pulse'
                      }}
                    />
                    <Circle
                      center={[espSOS.lat, espSOS.lon]}
                      radius={4000}
                      pathOptions={{
                        color: '#ff4d4d',
                        fillColor: '#ff4d4d',
                        fillOpacity: 0.06,
                        weight: 1,
                        dashArray: '8, 8'
                      }}
                    />
                    {/* Rescue line from ESP32 SOS to coast */}
                    <Polyline
                      positions={[[espSOS.lat, espSOS.lon], coastlinePos]}
                      color="#ff1a1a"
                      dashArray="12, 8"
                      weight={3}
                    />
                  </>
                )}
              </MapContainer>
            )}
            <div className="weather-overlay">
               <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,11,24,0.95)', border: '1px solid var(--accent-blue-glow)' }}>
                 <span style={{ fontSize: '1.5rem' }}>🌫️</span>
                 <div><div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>WAVE</div><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{incoisData.waveHeight}m</div></div>
               </div>
               <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,11,24,0.95)', border: '1px solid var(--accent-blue-glow)' }}>
                 <span style={{ fontSize: '1.5rem' }}>🌪️</span>
                 <div><div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>WIND</div><div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-blue)' }}>{incoisData.windSpeed}km/h</div></div>
               </div>
            </div>
          </div>
        </main>

        {/* RIGHT: INTELLIGENCE & MARKET BROADCAST */}
        <aside className="dashboard-right">
          <div className="glass-card" style={{ background: 'rgba(255,77,77,0.03)', borderColor: sosVessels.length > 0 ? 'var(--accent-orange)' : 'var(--glass-border)' }}>
             <h3 style={{ fontSize: '0.8rem', marginBottom: '15px', color: 'var(--accent-orange)', fontWeight: 800, letterSpacing: '0.1em' }}>🔴 LIVE DISTRESS QUEUE</h3>
             {sosVessels.length === 0 ? <div style={{ fontSize: '0.8rem', opacity: 0.4, textAlign: 'center', padding: '30px' }}>SAFE SECTOR.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {sosVessels.map((v: any) => (
                     <div key={`alert-${v.id}`} style={{ padding: '15px', background: 'rgba(255,77,77,0.1)', borderRadius: '16px', border: '1px solid var(--accent-orange)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', flexWrap: 'wrap', gap: '5px' }}>
                           <strong style={{ fontSize: '1rem', color: '#fff' }}>{v.name}</strong>
                           <span style={{ fontSize: '0.7rem', color: 'var(--accent-orange)', fontWeight: 800 }}>D: {getDistance(v.lat, v.lng, coastlinePos[0], coastlinePos[1])}km</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>TELEMETRY: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                           <button style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--accent-orange)', border: 'none', color: 'white', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}>DISPATCH</button>
                           <button onClick={() => resolveSOS(v.id)} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', cursor: 'pointer' }}>❌</button>
                        </div>
                     </div>
                   ))}
                </div>
             )}
          </div>

          <div className="glass-card" style={{ background: 'rgba(0,255,136,0.03)', borderColor: 'rgba(0,255,136,0.3)' }}>
             <h3 style={{ fontSize: '0.8rem', marginBottom: '15px', color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '0.1em' }}>🛰️ PFZ SATELLITE BROADCAST</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input value={newPFZ.lat} onChange={e => setNewPFZ({...newPFZ, lat: e.target.value})} type="number" placeholder="LAT" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', width: '100%' }} />
                  <input value={newPFZ.lng} onChange={e => setNewPFZ({...newPFZ, lng: e.target.value})} type="number" placeholder="LNG" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', width: '100%' }} />
                </div>
                <input value={newPFZ.name} onChange={e => setNewPFZ({...newPFZ, name: e.target.value})} placeholder="ZONE NAME (E.G. TUNA HUB)" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '0.8rem', fontWeight: 600, width: '100%' }} />
                <button onClick={handleBroadcastPFZ} style={{ width: '100%', background: 'var(--accent-green)', color: 'black', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', boxShadow: '0 0 20px var(--accent-green-glow)' }}>PUBLISH ZONE</button>
             </div>
          </div>

          <div className="glass-card" style={{ flex: 1, overflowY: 'auto' }}>
             <h3 style={{ fontSize: '0.8rem', marginBottom: '20px', color: 'var(--accent-blue)', fontWeight: 800, letterSpacing: '0.1em' }}>📈 PRICE BROADCASTER</h3>
             <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(0,210,255,0.03)', borderRadius: '16px', border: '1px solid var(--accent-blue-glow)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input value={newFish.species} onChange={e => setNewFish({...newFish, species: e.target.value})} placeholder="SPECIES" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', color: 'white', width: '100%' }} />
                  <input value={newFish.malayalam} onChange={e => setNewFish({...newFish, malayalam: e.target.value})} placeholder="മലയാളം" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', color: 'white', width: '100%' }} />
                  <input value={newFish.port} onChange={e => setNewFish({...newFish, port: e.target.value})} placeholder="PORT" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', color: 'white', width: '100%' }} />
                  <input value={newFish.price} onChange={e => setNewFish({...newFish, price: e.target.value})} type="number" placeholder="₹ PRICE" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem', color: 'white', width: '100%' }} />
                </div>
                <button onClick={handleUpdateMarket} style={{ width: '100%', background: 'var(--accent-blue)', border: 'none', padding: '12px', borderRadius: '10px', color: 'black', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem' }}>PUSH TO MESH</button>
             </div>
             
             <select value={selectedDashboardMarket} onChange={(e) => setSelectedDashboardMarket(e.target.value)} style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', color: 'white', border: '1px solid var(--glass-border)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '15px' }}>
                {markets.map(m => <option key={m} value={m} style={{ background: '#030812' }}>{m}</option>)}
             </select>

             <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left', opacity: 0.5 }}><th style={{ padding: '10px' }}>SPECIES</th><th style={{ padding: '10px' }}>RATE/KG</th></tr></thead>
                <tbody>
                  {filteredMarket.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px' }}><div style={{ fontWeight: 800, color: 'white' }}>{item.malayalam}</div><div style={{ fontSize: '0.65rem', color: 'var(--accent-blue)', opacity: 0.8 }}>{item.species.toUpperCase()}</div></td>
                      <td style={{ padding: '12px', color: 'var(--accent-green)', fontWeight: 900, fontSize: '1.2rem' }}>₹{item.price}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </aside>
      </div>
    </>
  );
}
