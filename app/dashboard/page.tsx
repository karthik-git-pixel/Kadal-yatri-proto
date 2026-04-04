'use client';

import { useSimulation } from '@/lib/simulation';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false });

export default function CommandDashboard() {
  const { state, resolveSOS, updateMarketItem, addPFZZone } = useSimulation();
  const { vessels, incoisData, marketData, pfzZones } = state;
  
  const [selectedDashboardMarket, setSelectedDashboardMarket] = useState<string>('Vizhinjam');
  const [L, setL] = useState<any>(null);

  const [newFish, setNewFish] = useState({ species: '', malayalam: '', port: '', price: '' });
  const [newPFZ, setNewPFZ] = useState({ lat: '', lng: '', name: '' });

  const markets = Array.from(new Set(marketData.map(m => m.port)));
  const filteredMarket = marketData.filter(m => m.port === selectedDashboardMarket);

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

      <div className="dashboard-grid">
      
        {/* LEFT: FLEET STATUS & TELEMETRY */}
        <aside className="dashboard-left">
          <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(0,210,255,0.05), transparent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-blue)' }}>🛰️ COMMAND</h2>
               <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>V.1.0-STABLE</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '15px', border: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white' }}>{vessels.length}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', letterSpacing: '0.1em', fontWeight: 800 }}>TOTAL VESSELS</div>
              </div>
              <div style={{ background: sosVessels.length > 0 ? 'rgba(255,77,77,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '15px', border: `1px solid ${sosVessels.length > 0 ? 'var(--accent-orange)' : 'var(--glass-border)'}` }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: sosVessels.length > 0 ? 'var(--accent-orange)' : 'white' }}>{sosVessels.length}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-orange)', letterSpacing: '0.1em', fontWeight: 800 }}>ACTIVE SOS</div>
              </div>
            </div>
          </div>

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
