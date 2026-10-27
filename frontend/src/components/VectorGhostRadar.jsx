import React, { useMemo, useState } from 'react';
import { Activity, Eye, AlertTriangle, Shield, Cpu, Crosshair } from 'lucide-react';
import { computeVectorForensics } from '../ai/phantomAgent';

export default function VectorGhostRadar({ scanData, selectedMatch, matches = [], onSelectMatch }) {
  const [hoveredDim, setHoveredDim] = useState(null);

  const originalVec = scanData?.primary_face?.embedding || [];
  const phantomVec = selectedMatch?.phantom_embedding || [];

  const metrics = useMemo(
    () => computeVectorForensics(originalVec, phantomVec),
    [originalVec, phantomVec]
  );

  // Build 16-point polar radar polygon coordinates from the 128-D vectors (8 dims averaged per sector)
  const radarPoints = useMemo(() => {
    const sectors = 16;
    const origPts = [];
    const phanPts = [];
    const cx = 110;
    const cy = 110;
    const maxR = 82;

    for (let s = 0; s < sectors; s++) {
      const angle = (Math.PI * 2 * s) / sectors - Math.PI / 2;
      let sumO = 0;
      let sumP = 0;
      for (let k = 0; k < 8; k++) {
        const idx = s * 8 + k;
        sumO += Math.abs(originalVec[idx] ?? 0.08);
        sumP += Math.abs(phantomVec[idx] ?? 0.085);
      }
      const normO = Math.min(1, Math.max(0.22, (sumO / 8) * 9.5));
      const normP = Math.min(1, Math.max(0.22, (sumP / 8) * 9.5));

      const rO = normO * maxR;
      const rP = normP * maxR;

      origPts.push(`${(cx + Math.cos(angle) * rO).toFixed(1)},${(cy + Math.sin(angle) * rO).toFixed(1)}`);
      phanPts.push(`${(cx + Math.cos(angle) * rP).toFixed(1)},${(cy + Math.sin(angle) * rP).toFixed(1)}`);
    }

    return {
      origPolygon: origPts.join(' '),
      phanPolygon: phanPts.join(' '),
    };
  }, [originalVec, phantomVec]);

  const cosPercent = (metrics.cosineSimilarity * 100).toFixed(2);
  const isHighThreat = metrics.cosineSimilarity >= 0.88;

  return (
    <div
      style={{
        background: '#0C0E14',
        border: '1px solid rgba(0, 255, 156, 0.22)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 0 30px -10px rgba(0, 255, 156, 0.15)',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(0, 255, 156, 0.1)',
              border: '1px solid rgba(0, 255, 156, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00FF9C',
            }}
          >
            <Crosshair size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: '#00FF9C',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                128-D Vector Ghost Radar
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: isHighThreat ? 'rgba(255, 77, 77, 0.16)' : 'rgba(0, 255, 156, 0.14)',
                  border: `1px solid ${isHighThreat ? '#FF4D4D' : '#00FF9C'}`,
                  color: isHighThreat ? '#FF4D4D' : '#00FF9C',
                  fontWeight: 700,
                }}
              >
                {isHighThreat ? '⚠️ DOPPELGÄNGER LOCK' : 'VECTOR LOCKED'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              Real-time L2 hypersphere overlay: <strong style={{ color: '#00FF9C' }}>Living Original</strong> vs.{' '}
              <strong style={{ color: '#FF4D4D' }}>Detected Web Phantom</strong>
            </p>
          </div>
        </div>

        {/* Target Switcher Pills if multiple OSINT phantoms */}
        {matches.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="font-mono" style={{ fontSize: 10, color: '#64748B', marginRight: 4 }}>
              PHANTOM TARGET:
            </span>
            {matches.slice(0, 4).map((m, i) => {
              const active = selectedMatch?.id === m.id;
              return (
                <button
                  key={m.id || i}
                  onClick={() => onSelectMatch && onSelectMatch(m)}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: active ? 'rgba(255, 77, 77, 0.18)' : '#090A0F',
                    border: `1px solid ${active ? '#FF4D4D' : '#1E293B'}`,
                    color: active ? '#FF4D4D' : '#94A3B8',
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  #{i + 1} {m.platform}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Radar + Telemetry Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 18,
          marginTop: 16,
          alignItems: 'center',
        }}
      >
        {/* Left: Polar Vector Oscilloscope */}
        <div
          style={{
            background: '#090A0F',
            border: '1px solid #18222D',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <svg width="220" height="220" viewBox="0 0 220 220">
            {/* Concentric Radar Rings */}
            {[24, 48, 72, 92].map((r) => (
              <circle
                key={r}
                cx="110"
                cy="110"
                r={r}
                fill="none"
                stroke="rgba(0, 255, 156, 0.12)"
                strokeDasharray={r === 72 ? '3 3' : undefined}
              />
            ))}
            {/* Crosshair Axes */}
            <line x1="18" y1="110" x2="202" y2="110" stroke="rgba(0, 255, 156, 0.12)" />
            <line x1="110" y1="18" x2="110" y2="202" stroke="rgba(0, 255, 156, 0.12)" />
            <line x1="45" y1="45" x2="175" y2="175" stroke="rgba(0, 255, 156, 0.08)" />
            <line x1="175" y1="45" x2="45" y2="175" stroke="rgba(0, 255, 156, 0.08)" />

            {/* Living Original Polygon (#00FF9C) */}
            <polygon
              points={radarPoints.origPolygon}
              fill="rgba(0, 255, 156, 0.16)"
              stroke="#00FF9C"
              strokeWidth="2"
            />

            {/* Detected Web Phantom Polygon (#FF4D4D) */}
            <polygon
              points={radarPoints.phanPolygon}
              fill="rgba(255, 77, 77, 0.16)"
              stroke="#FF4D4D"
              strokeWidth="1.75"
              strokeDasharray="4 2"
            />

            <circle cx="110" cy="110" r="3" fill="#00FF9C" />
          </svg>

          <div
            className="font-mono"
            style={{
              display: 'flex',
              gap: 14,
              fontSize: 10,
              marginTop: 6,
            }}
          >
            <span style={{ color: '#00FF9C', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00FF9C', display: 'inline-block' }} />
              LIVING ORIGINAL
            </span>
            <span style={{ color: '#FF4D4D', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF4D4D', display: 'inline-block' }} />
              WEB PHANTOM
            </span>
          </div>
        </div>

        {/* Center/Right: Similarity Gauges & Sub-Band Drift */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary Similarity & L2 Distance Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div
              style={{
                background: '#090A0F',
                border: '1px solid rgba(255, 77, 77, 0.35)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <span className="font-mono" style={{ fontSize: 10, color: '#94A3B8', display: 'block' }}>
                COSINE SIMILARITY
              </span>
              <div
                className="font-mono"
                style={{ fontSize: 22, fontWeight: 800, color: '#FF4D4D', marginTop: 2 }}
              >
                {cosPercent}%
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: '#FCA5A5' }}>
                {selectedMatch?.doppelganger_type?.split('(')[0] || 'Doppelgänger Match'}
              </span>
            </div>

            <div
              style={{
                background: '#090A0F',
                border: '1px solid rgba(0, 255, 156, 0.3)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <span className="font-mono" style={{ fontSize: 10, color: '#94A3B8', display: 'block' }}>
                EUCLIDEAN DISTANCE ||u-v||₂
              </span>
              <div
                className="font-mono"
                style={{ fontSize: 22, fontWeight: 800, color: '#00FF9C', marginTop: 2 }}
              >
                {metrics.euclideanDistance.toFixed(4)}
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: '#6EE7B7' }}>
                Sighting: {selectedMatch?.sighting_time_utc || '03:14:09 UTC'}
              </span>
            </div>
          </div>

          {/* 3 Sub-Vector Drift Bars */}
          <div
            style={{
              background: '#090A0F',
              border: '1px solid #18222D',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="font-mono" style={{ fontSize: 10, color: '#94A3B8', letterSpacing: 1 }}>
              SUB-VECTOR DRIFT BREAKDOWN (L2 HYPERSPHERE)
            </div>

            {[
              { label: 'Dims 00..31 (Craniofacial Geometry)', val: metrics.geometry32Drift, color: '#00FF9C' },
              { label: 'Dims 32..95 (Spatial Gradients)', val: metrics.gradient64Drift, color: '#38BDF8' },
              { label: 'Dims 96..127 (2D-DCT Spectral GAN Check)', val: metrics.dct32Drift, color: '#FF4D4D' },
            ].map((band) => {
              const pct = Math.min(100, Math.max(12, band.val * 700));
              return (
                <div key={band.label}>
                  <div
                    className="font-mono"
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}
                  >
                    <span style={{ color: '#CBD5E1' }}>{band.label}</span>
                    <span style={{ color: band.color }}>Δ = {band.val.toFixed(4)}</span>
                  </div>
                  <div style={{ height: 5, background: '#111827', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: band.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: 64-Channel Dual Vector Spectrum Bar Chart */}
      <div
        style={{
          marginTop: 16,
          background: '#090A0F',
          border: '1px solid #18222D',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            color: '#94A3B8',
            marginBottom: 8,
          }}
        >
          <span>128-D EMBEDDING SPECTRUM OVERLAY (HOVER BARS TO INSPECT DIMENSION DELTA)</span>
          <span style={{ color: hoveredDim ? '#00FF9C' : '#64748B' }}>
            {hoveredDim
              ? `Dim #${hoveredDim.idx}: Living=${hoveredDim.orig} | Phantom=${hoveredDim.phan} | Δ=${hoveredDim.delta}`
              : `dHash: ${scanData?.phash || 'N/A'}`}
          </span>
        </div>

        <div
          style={{
            height: 54,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            padding: '4px 2px',
          }}
        >
          {Array.from({ length: 64 }).map((_, idx) => {
            const oVal = Number(originalVec[idx] ?? 0.08);
            const pVal = Number(phantomVec[idx] ?? 0.09);
            const delta = Math.abs(oVal - pVal);
            const hOrig = Math.min(100, Math.max(12, Math.abs(oVal) * 380));
            const hPhan = Math.min(100, Math.max(12, Math.abs(pVal) * 380));
            const isSpike = delta > 0.032;

            return (
              <div
                key={idx}
                onMouseEnter={() =>
                  setHoveredDim({
                    idx,
                    orig: oVal.toFixed(4),
                    phan: pVal.toFixed(4),
                    delta: delta.toFixed(4),
                  })
                }
                onMouseLeave={() => setHoveredDim(null)}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  position: 'relative',
                  cursor: 'crosshair',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${hOrig}%`,
                    background: isSpike ? '#FF4D4D' : '#00FF9C',
                    opacity: isSpike ? 0.95 : 0.72,
                    borderRadius: '1px 1px 0 0',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${hPhan}%`,
                    borderTop: '2px solid #FF4D4D',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
