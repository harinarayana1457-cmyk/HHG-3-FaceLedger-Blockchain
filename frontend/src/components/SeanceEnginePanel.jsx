import React, { useState } from 'react';
import { Terminal, ShieldCheck, Sliders, Sparkles, RefreshCw, Lock, Eye, Cpu } from 'lucide-react';
import { SYSTEM_PROMPT_PRESETS } from '../ai/phantomAgent';

export default function SeanceEnginePanel({
  seanceReport,
  seanceLoading,
  selectedModel,
  ollamaStatus,
  systemPrompt,
  setSystemPrompt,
  personaKey,
  setPersonaKey,
  showPromptEditor,
  setShowPromptEditor,
  onReRunSeance,
}) {
  const [activeTab, setActiveTab] = useState('spooky'); // 'spooky' | 'forensic'

  const handleSelectPreset = (key) => {
    const preset = SYSTEM_PROMPT_PRESETS[key];
    if (!preset) return;
    setPersonaKey(key);
    setSystemPrompt(preset.prompt);
    if (onReRunSeance) {
      onReRunSeance(preset.prompt, key);
    }
  };

  return (
    <div
      style={{
        background: '#0C0E14',
        border: '1px solid rgba(0, 255, 156, 0.25)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 0 32px -10px rgba(0, 255, 156, 0.16)',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(0, 255, 156, 0.12)',
              border: '1px solid rgba(0, 255, 156, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00FF9C',
            }}
          >
            <Terminal size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: '#00FF9C',
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Open-Weight AI "Séance Engine"
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'rgba(0, 255, 156, 0.12)',
                  border: '1px solid rgba(0, 255, 156, 0.35)',
                  color: '#00FF9C',
                }}
              >
                {selectedModel}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: ollamaStatus?.online ? 'rgba(0, 255, 156, 0.16)' : 'rgba(56, 189, 248, 0.14)',
                  border: `1px solid ${ollamaStatus?.online ? '#00FF9C' : '#38BDF8'}`,
                  color: ollamaStatus?.online ? '#00FF9C' : '#38BDF8',
                }}
              >
                {ollamaStatus?.online
                  ? '🟢 OLLAMA DAEMON (:11434)'
                  : '🛡️ AIR-GAPPED DETERMINISTIC ENGINE'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              Synthesizes 128-D vector distances, nocturnal OSINT timestamps, and Merkle proofs with zero cloud calls.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: showPromptEditor ? 'rgba(0, 255, 156, 0.18)' : '#090A0F',
              border: '1px solid rgba(0, 255, 156, 0.35)',
              color: '#00FF9C',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} />
            <span>{showPromptEditor ? 'Hide Prompt Editor' : 'System Prompt Editor'}</span>
          </button>

          <button
            onClick={() => onReRunSeance && onReRunSeance(systemPrompt, personaKey)}
            disabled={seanceLoading}
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: '#00FF9C',
              border: '1px solid #00FF9C',
              color: '#090A0F',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={seanceLoading ? 'animate-spin' : ''} />
            <span>{seanceLoading ? 'Channeling...' : 'Re-Invoke Séance'}</span>
          </button>
        </div>
      </div>

      {/* Expandable System Prompt Editor */}
      {showPromptEditor && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: '#090A0F',
            border: '1px solid rgba(0, 255, 156, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span className="font-mono" style={{ fontSize: 11, color: '#00FF9C', fontWeight: 700 }}>
              ⚙️ CUSTOMIZABLE AGENT SYSTEM PROMPT & PERSONA PRESETS
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.values(SYSTEM_PROMPT_PRESETS).map((preset) => {
                const active = personaKey === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '4px 9px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: active ? 'rgba(0, 255, 156, 0.2)' : '#111827',
                      border: `1px solid ${active ? '#00FF9C' : '#1E293B'}`,
                      color: active ? '#00FF9C' : '#CBD5E1',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            rows={3}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono"
            style={{
              width: '100%',
              background: '#050608',
              border: '1px solid #1E293B',
              borderRadius: 8,
              padding: 10,
              color: '#00FF9C',
              fontSize: 11,
              lineHeight: 1.5,
              outline: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
              fontSize: 11,
              color: '#64748B',
            }}
          >
            <span className="font-mono">
              Endpoint: http://localhost:11434/api/generate (Auto-Fallback Enabled)
            </span>
            <button
              onClick={() => onReRunSeance && onReRunSeance(systemPrompt, personaKey)}
              className="font-mono"
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                background: 'rgba(0, 255, 156, 0.16)',
                border: '1px solid #00FF9C',
                color: '#00FF9C',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Apply Prompt & Regenerate Report
            </button>
          </div>
        </div>
      )}

      {/* Structured Two-Tab Selector */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 16,
          borderBottom: '1px solid #18222D',
          paddingBottom: 10,
        }}
      >
        <button
          onClick={() => setActiveTab('spooky')}
          className="font-mono"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            background: activeTab === 'spooky' ? 'rgba(0, 255, 156, 0.14)' : '#090A0F',
            border: `1.5px solid ${activeTab === 'spooky' ? '#00FF9C' : '#18222D'}`,
            color: activeTab === 'spooky' ? '#00FF9C' : '#94A3B8',
          }}
        >
          <span>👻 1. "Ghost in the Machine Log" (Spooky Mode)</span>
        </button>

        <button
          onClick={() => setActiveTab('forensic')}
          className="font-mono"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            background: activeTab === 'forensic' ? 'rgba(56, 189, 248, 0.14)' : '#090A0F',
            border: `1.5px solid ${activeTab === 'forensic' ? '#38BDF8' : '#18222D'}`,
            color: activeTab === 'forensic' ? '#38BDF8' : '#94A3B8',
          }}
        >
          <span>🛡️ 2. "Forensic & Privacy Audit" (Technical Mode)</span>
        </button>
      </div>

      {/* Output Terminal Console */}
      <div
        style={{
          marginTop: 12,
          background: '#06070B',
          border: `1px solid ${activeTab === 'spooky' ? 'rgba(0, 255, 156, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
          borderRadius: 12,
          padding: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {seanceLoading ? (
          <div
            className="font-mono"
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              color: '#00FF9C',
              fontSize: 12,
            }}
          >
            🔮 Channeling local open-weight model [{selectedModel}] across 128-D hyperspace...
          </div>
        ) : (
          <pre
            className="font-mono"
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              lineHeight: 1.65,
              color: activeTab === 'spooky' ? '#00FF9C' : '#E2E8F0',
            }}
          >
            {activeTab === 'spooky'
              ? seanceReport?.spookyLog || 'Awaiting biometric séance scan...'
              : seanceReport?.forensicAudit || 'Awaiting forensic telemetry...'}
          </pre>
        )}
      </div>
    </div>
  );
}
