'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      gap: '40px', 
      padding: '20px',
      backgroundImage: 'linear-gradient(to bottom, rgba(3, 8, 18, 0.6), rgba(3, 8, 18, 0.95)), url("/hero-bg.png")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #00d2ff, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>KADAL YATRI</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginTop: '10px' }}>Empowering Small-Scale Fishers through Mesh-Networked Safety & Intelligence.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', width: '100%', maxWidth: '900px' }}>
        <Link href="/fisherman" style={{ textDecoration: 'none' }}>
          <div className="glass-card" style={{ height: '100%', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <div style={{ fontSize: '3rem' }}>🧭</div>
             <h2 style={{ fontSize: '1.5rem' }}>Fisherman App</h2>
             <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Mobile-first NavIC compass, SOS button, and sea state alerts.</p>
             <div style={{ marginTop: 'auto', color: 'var(--accent-blue)', fontWeight: 600 }}>ENTER PORTAL →</div>
          </div>
        </Link>

        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div className="glass-card" style={{ height: '100%', cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <div style={{ fontSize: '3rem' }}>🛰️</div>
             <h2 style={{ fontSize: '1.5rem' }}>Command Center</h2>
             <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Live vessel monitoring, mesh network tracking, and rescue dispatch.</p>
             <div style={{ marginTop: 'auto', color: 'var(--accent-blue)', fontWeight: 600 }}>ENTER HUB →</div>
          </div>
        </Link>
      </div>

    </main>
  );
}
