'use client';

import { useSimulation, IncoisData } from '@/lib/simulation';
import { useState, useRef } from 'react';

export default function FishermanPage() {
  const { state, triggerSOS, resolveSOS, fetchLocationSafety } = useSimulation();
  const { vessels, incoisData, userVesselId, marketData, pfzZones } = state;
  const vessel = vessels.find(v => v.id === userVesselId);
  
  const [activeTab, setActiveTab] = useState<'compass' | 'market' | 'safety'>('compass');
  const [selectedMarket, setSelectedMarket] = useState<string>('Vizhinjam');
  
  const [queryLat, setQueryLat] = useState(vessel?.lat.toFixed(4) || '8.3452');
  const [queryLng, setQueryLng] = useState(vessel?.lng.toFixed(4) || '76.8921');
  const [liveSafety, setLiveSafety] = useState<IncoisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [weather, setWeather] = useState<any | null>(null);
  const [malayalamVerdict, setMalayalamVerdict] = useState<string>('');

  if (!vessel) return <div style={{ color: 'white', padding: '100px', textAlign: 'center' }}>⚙️ Syncing NavIC telemetry...</div>;

  const markets = Array.from(new Set(marketData.map(m => m.port)));
  const filteredMarket = marketData.filter(m => m.port === selectedMarket);

  const getSafetyClass = (wave: number) => {
    if (wave > 2.0) return { status: 'അപകടകരം (Hazardous)', color: 'var(--accent-orange)', note: 'കടൽക്ഷോഭം - മത്സ്യബന്ധനത്തിന് ഇറങ്ങരുത്', icon: '⚡' };
    if (wave > 1.4) return { status: 'ജാഗ്രത (Caution)', color: '#fdd835', note: 'തിരമാലകൾ ശക്തമാണ് - ജാഗ്രത പാലിക്കുക', icon: '⚠️' };
    return { status: 'സുരക്ഷിതം (Safe)', color: 'var(--accent-green)', note: 'മത്സ്യബന്ധനത്തിന് അനുയോജ്യമായ സാഹചര്യം', icon: '✅' };
  };

  const handleCheckSafety = async () => {
    setIsLoading(true);
    const data = await fetchLocationSafety(parseFloat(queryLat), parseFloat(queryLng));
    setLiveSafety(data);
    // fetch weather via server-side proxy at /api/weather
    try {
      const resp = await fetch(`/api/weather?lat=${queryLat}&lon=${queryLng}`);
      if (resp.ok) {
        const w = await resp.json();
        setWeather(w);
        const verdict = evaluateSafetyVerdict(data, w);
        setMalayalamVerdict(verdict);
      } else {
        const err = await resp.json().catch(() => ({}));
        setWeather(null);
        setMalayalamVerdict(err?.error || 'കാലാവസ്ഥാ സേവനം ലഭ്യമല്ല');
      }
    } catch (err) {
      setWeather(null);
      setMalayalamVerdict('വെബ്ബ് സേവനത്തെ ബന്ധിപ്പിക്കാൻ പരാജയപ്പെട്ടു.');
    }
    setIsLoading(false);
  };

  const useMyLocationOnce = () => {
    if (!('geolocation' in navigator)) {
      setMalayalamVerdict('ഈ ബ്രൗസറിൽ ജിയോളൊക്കേഷൻ പിന്തുണയില്ല.');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lng = pos.coords.longitude.toFixed(4);
      setQueryLat(lat);
      setQueryLng(lng);
    }, (err) => {
      setMalayalamVerdict('സ്ഥലം ലഭ്യമല്ല — സജ്ജീകരണങ്ങൾ പരിശോധിക്കുക.');
    }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const toggleTracking = () => {
    if (!('geolocation' in navigator)) {
      setMalayalamVerdict('ജിയോളൊക്കേഷൻ പിന്തുണയില്ല.');
      return;
    }
    if (isTracking) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
      setMalayalamVerdict('ട്രാക്കിംഗ് നിർത്തി.');
      return;
    }
    const id = navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(4);
      const lng = pos.coords.longitude.toFixed(4);
      setQueryLat(lat);
      setQueryLng(lng);
    }, (err) => {
      setMalayalamVerdict('ട്രാക്കിംഗ് ലഭ്യമാകുന്നില്ല.');
    }, { enableHighAccuracy: true, maximumAge: 5000 });
    watchIdRef.current = id as unknown as number;
    setIsTracking(true);
    setMalayalamVerdict('സ്ഥലം ട്രാക്കിംഗ് ആരംഭിച്ചു.');
  };

  const evaluateSafetyVerdict = (inc: IncoisData, w: any) => {
    // inc.waveHeight (m), w.wind.speed (m/s), w.weather[0].main
    const wave = inc?.waveHeight ?? 0;
    const windMs = w?.wind?.speed ?? 0;
    const windKmh = Math.round(windMs * 3.6);
    const weatherMain = (w?.weather && w.weather[0] && w.weather[0].main) || '';

    // priority unsafe conditions
    if (/Thunderstorm|Tornado|Squall/i.test(weatherMain)) return `അപായസൂചകം: ശക്തമായ=${weatherMain}. തിരമാല ${wave}m, കാറ്റ് ${windKmh} km/h — കടലിലേക്കു പോകരുത്.`;
    if (windMs >= 12 || wave > 2.0) return `അപായസൂചകം: തിരമാലയും/കാറ്റും അപകടകരം. തിരമാല ${wave}m, കാറ്റ് ${windKmh} km/h — പുറത്തേക്കു പോകരുത്.`;
    if (windMs >= 6 || wave > 1.4) return `ജാഗ്രത: സാഹചര്യങ്ങള്‍ അസ്സല്‍തരം. തിരമാല ${wave}m, കാറ്റ് ${windKmh} km/h — ജാഗ്രത പാലിച്ച് പുറപ്പെടുക.`;
    return `സുരക്ഷിതം: ഇത് സുരക്ഷിത കാലാവസ്ഥയാണ്. തിരമാല ${wave}m, കാറ്റ് ${windKmh} km/h — സുരക്ഷിതമായി മത്സ്യബന്ധനം കഴിയും.`;
  };

  const currentSafety = liveSafety || incoisData;
  const safetyInfo = getSafetyClass(currentSafety.waveHeight);

  const handleSOS = () => {
    if (vessel.status === 'SOS') resolveSOS(vessel.id);
    else triggerSOS(vessel.id);
  };

  return (
    <main style={{ padding: '15px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', height: '100vh', overflowY: 'auto', paddingBottom: '120px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 5px' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.2em', fontWeight: 600 }}>NAVIC-LORA CORE</div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{vessel.name}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`status-badge ${vessel.status === 'SOS' ? 'status-sos' : 'status-active'}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            {vessel.status}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
            BATTERY: {Math.floor(vessel.battery)}%
          </div>
        </div>
      </div>

      {activeTab === 'compass' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.5s ease' }}>
          <div className="glass-card" style={{ textAlign: 'center', border: '1px solid rgba(0,210,255,0.1)' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '0.7rem', color: 'var(--accent-blue)', letterSpacing: '0.2em', fontWeight: 800 }}>MAGNETIC HEADING</h3>
            <div className="compass-container">
              <div className="compass-needle" style={{ transform: `rotate(${vessel.heading}deg)` }}></div>
              <div style={{ position: 'absolute', fontWeight: 800, color: 'white', fontSize: '2.5rem', fontFamily: 'var(--font-mono)' }}>
                {Math.floor(vessel.heading)}°
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', padding: '0 10px' }}>
              <div style={{ textAlign: 'left', borderLeft: '2px solid var(--accent-blue)', paddingLeft: '12px' }}>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>LATITUDE</span>
                <code style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>{vessel.lat.toFixed(4)}</code>
              </div>
              <div style={{ textAlign: 'right', borderRight: '2px solid var(--accent-blue)', paddingRight: '12px' }}>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>LONGITUDE</span>
                <code style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>{vessel.lng.toFixed(4)}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
            <button onClick={handleSOS} className="btn-sos">
              <span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', transform: 'scale(1.2)', zIndex: -1, animation: 'sos-pulse-ring 2s infinite' }} />
              {vessel.status === 'SOS' ? 'STOP' : 'SOS'}
            </button>
          </div>

          <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-green)', background: 'linear-gradient(to right, rgba(0,255,136,0.05), transparent)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--accent-green)', letterSpacing: '0.1em', fontWeight: 800 }}>PFZ HOTSPOT ADVISORY</h3>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {pfzZones.length === 0 ? <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>No hotspots broadcasted.</p> : (
                  pfzZones.map(z => {
                    const dist = (Math.sqrt(Math.pow(vessel.lat - z.lat, 2) + Math.pow(vessel.lng - z.lng, 2)) * 111).toFixed(1);
                    return (
                      <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                        <div>
                           <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{z.name}</div>
                           <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>{z.lat}, {z.lng} • CONF: {z.confidence}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                           <div style={{ color: 'var(--accent-green)', fontWeight: 800, fontSize: '1.2rem' }}>{dist}km</div>
                        </div>
                      </div>
                    );
                  })
                )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', animation: 'slideUp 0.4s ease' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>🌊 INCOIS കടൽ നില</h2>
             <div style={{ fontSize: '0.6rem', color: 'var(--accent-blue)', border: '1px solid currentColor', padding: '4px 8px', borderRadius: '4px' }}>LIVE FEED</div>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>സ്ഥലം പരിശോധിക്കുക (COORDINATES)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input value={queryLat} onChange={e => setQueryLat(e.target.value)} placeholder="Lat" style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'white', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }} />
                <input value={queryLng} onChange={e => setQueryLng(e.target.value)} placeholder="Lng" style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '10px', color: 'white', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={useMyLocationOnce} style={{ flex: 1, padding: '12px', background: 'var(--accent-green)', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, cursor: 'pointer' }}>എന്റെ സ്ഥലം ഉപയോഗിക്കുക</button>
                <button onClick={toggleTracking} style={{ padding: '12px 14px', background: isTracking ? '#ff5252' : 'var(--accent-blue)', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, cursor: 'pointer' }}>{isTracking ? 'ട്രാക്കിംഗ് നിർത്തുക' : 'ട്രാക്കിംഗ് ആരംഭിക്കുക'}</button>
              </div>
              <button onClick={handleCheckSafety} disabled={isLoading} style={{ width: '100%', padding: '15px', background: 'var(--accent-blue)', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 900, cursor: 'pointer', marginTop: '8px', boxShadow: `0 0 20px ${isLoading ? 'transparent' : 'var(--accent-blue-glow)'}` }}>
                {isLoading ? 'സിസ്റ്റം പരിശോധിക്കുന്നു...' : 'സുരക്ഷാ പരിശോധന (CHECK)'}
              </button>
              {malayalamVerdict && (
                <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(0,0,0,0.35)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.95rem' }}>{malayalamVerdict}</div>
              )}
           </div>

           <div style={{ padding: '30px', background: `linear-gradient(135deg, ${safetyInfo.color}15, transparent)`, borderRadius: '24px', border: `2px solid ${safetyInfo.color}`, textAlign: 'center', boxShadow: `0 0 30px ${safetyInfo.color}10` }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '15px', filter: `drop-shadow(0 0 10px ${safetyInfo.color})` }}>{safetyInfo.icon}</div>
              <h3 style={{ color: safetyInfo.color, fontSize: '1.8rem', marginBottom: '10px', fontWeight: 900, letterSpacing: '-0.02em' }}>{safetyInfo.status}</h3>
              <p style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.9 }}>{safetyInfo.note}</p>
           </div>

           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                 <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '5px' }}>WAVE HEIGHT</div>
                 <div style={{ fontSize: '1.6rem', fontWeight: 800, color: safetyInfo.color }}>{currentSafety.waveHeight}m</div>
                 <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>തിരമാലയുടെ ഉയരം</div>
              </div>
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                 <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '5px' }}>WIND SPEED</div>
                 <div style={{ fontSize: '1.6rem', fontWeight: 800, color: safetyInfo.color }}>{currentSafety.windSpeed}<span style={{fontSize:'0.7rem'}}>km/h</span></div>
                 <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>കാറ്റിന്റെ വേഗത</div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'market' && (
        <div className="glass-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'slideUp 0.4s ease' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>📌 FMPIS വിപണി വില</h2>
             <div style={{ fontSize: '0.6rem', color: '#fdd835', border: '1px solid currentColor', padding: '4px 8px', borderRadius: '4px' }}>MARKET FISH</div>
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ലാൻഡിംഗ് സെന്റർ തിരഞ്ഞെടുക്കുക</label>
              <select value={selectedMarket} onChange={(e) => setSelectedMarket(e.target.value)} style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '14px', color: 'white', border: '1px solid var(--glass-border)', fontSize: '1.1rem', fontWeight: 600 }}>
                {markets.map(m => <option key={m} value={m} style={{ background: '#030812' }}>{m}</option>)}
              </select>
           </div>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredMarket.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', background: 'rgba(255,255,255,0.02)', borderRadius: '18px', border: '1px solid var(--glass-border)' }}>
                   <div>
                      <div style={{ fontWeight: 800, color: '#fdd835', fontSize: '1.1rem' }}>{item.malayalam}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '2px', letterSpacing: '0.05em' }}>{item.species.toUpperCase()}</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff' }}>₹{item.price}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>PER {item.unit.toUpperCase()}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* FOOTER NAV DOCK */}
      <div className="glass-card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-around', position: 'fixed', bottom: 20, left: 15, right: 15, zIndex: 1000, borderRadius: '24px', background: 'rgba(13, 19, 33, 0.9)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div onClick={() => setActiveTab('compass')} style={{ color: activeTab === 'compass' ? 'var(--accent-blue)' : 'var(--text-secondary)', textAlign: 'center', cursor: 'pointer', transition: '0.3s', flex: 1 }} className={activeTab === 'compass' ? 'tab-active' : ''}>
          <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>🧭</div>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em' }}>COMPASS</span>
        </div>
        <div onClick={() => setActiveTab('safety')} style={{ color: activeTab === 'safety' ? 'var(--accent-blue)' : 'var(--text-secondary)', textAlign: 'center', cursor: 'pointer', transition: '0.3s', flex: 1 }} className={activeTab === 'safety' ? 'tab-active' : ''}>
          <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>🌊</div>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em' }}>SAFETY</span>
        </div>
        <div onClick={() => setActiveTab('market')} style={{ color: activeTab === 'market' ? 'var(--accent-blue)' : 'var(--text-secondary)', textAlign: 'center', cursor: 'pointer', transition: '0.3s', flex: 1 }} className={activeTab === 'market' ? 'tab-active' : ''}>
          <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>📊</div>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em' }}>MARKET</span>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </main>
  );
}
