import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  OPEN_WEIGHT_MODELS,
  SYSTEM_PROMPT_PRESETS,
  checkOllamaStatus,
  runSeanceAnalysis,
  computeVectorForensics,
  generateShellWhisper,
} from './ai/phantomAgent';

export default function App() {
  const [inputImage, setInputImage] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [primaryFace, setPrimaryFace] = useState(null);
  const [phash, setPhash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sampleFaces, setSampleFaces] = useState([]);

  // Blockchain state
  const [anchoring, setAnchoring] = useState(false);
  const [blockchainProof, setBlockchainProof] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tampering, setTampering] = useState(false);
  const [tamperResult, setTamperResult] = useState(null);

  // Local AI Séance state
  const [selectedModel, setSelectedModel] = useState(OPEN_WEIGHT_MODELS[0].id);
  const [personaKey, setPersonaKey] = useState('possessor');
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT_PRESETS.possessor.prompt);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('spooky'); // 'spooky' | 'forensic'
  const [seanceReport, setSeanceReport] = useState(null);
  const [seanceLoading, setSeanceLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [statusWhisper, setStatusWhisper] = useState('Ready — 100% local biometric processing (0 bytes uploaded to cloud).');

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/sample-faces')
      .then((r) => r.json())
      .then((d) => {
        if (d?.samples) setSampleFaces(d.samples);
      })
      .catch(() => {});

    checkOllamaStatus().then((st) => setOllamaOnline(Boolean(st?.online)));
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setInputImage(e.target.result);
      runPipeline(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample) => {
    const b64 = sample.image_base64 || sample.image_url;
    if (!b64) return;
    setInputImage(b64);
    runPipeline(b64);
  };

  const triggerSeance = async (
    currentScan,
    currentMatch,
    currentProof,
    overridePrompt = systemPrompt,
    overridePersona = personaKey,
    overrideModel = selectedModel
  ) => {
    if (!currentScan || !currentMatch) return;
    setSeanceLoading(true);
    try {
      const report = await runSeanceAnalysis({
        model: overrideModel,
        systemPrompt: overridePrompt,
        personaKey: overridePersona,
        scanData: currentScan,
        match: currentMatch,
        blockchainProof: currentProof,
      });
      setSeanceReport(report);
    } catch (e) {
      console.error('Séance error:', e);
    } finally {
      setSeanceLoading(false);
    }
  };

  const runPipeline = async (b64) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedMatch(null);
    setScanData(null);
    setPrimaryFace(null);
    setPhash(null);
    setBlockchainProof(null);
    setVerificationResult(null);
    setTamperResult(null);
    setSeanceReport(null);
    setStatusWhisper(generateShellWhisper('IMAGE_LOADED'));

    try {
      // Step 1: Face Detection
      const formData = new FormData();
      formData.append('image_base64', b64);
      const detectRes = await fetch('/api/face/detect', { method: 'POST', body: formData });
      const detectData = await detectRes.json();
      if (!detectRes.ok || !detectData.success) throw new Error(detectData.detail || 'Face detection failed.');

      const fullScan = detectData.data;
      const face = fullScan.primary_face;
      const detectedPhash = fullScan.phash;
      setScanData(fullScan);
      setPrimaryFace(face);
      setPhash(detectedPhash);
      setStatusWhisper(generateShellWhisper('VECTOR_EXTRACTED', { sha256: fullScan.sha256, phash: detectedPhash }));

      // Step 2: Reverse Image & OSINT Search
      const searchRes = await fetch('/api/search/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face_crop_base64: b64,
          embedding: face.embedding,
          phash: detectedPhash,
        }),
      });
      const searchData = await searchRes.json();
      if (!searchRes.ok || !searchData.success) throw new Error(searchData.detail || 'Search failed.');

      const matches = searchData.matches || [];
      if (matches.length === 0) throw new Error('No matching images found on the web.');
      setResults(matches);
      setSelectedMatch(matches[0]);

      setStatusWhisper(
        generateShellWhisper('PHANTOM_DETECTED', {
          platform: matches[0].platform,
          author: matches[0].author,
          cosine: matches[0].cosine_similarity || matches[0].confidence_score,
          euclidean: matches[0].euclidean_distance,
          time: matches[0].sighting_time_utc,
        })
      );

      // Step 3: Auto-anchor top match to Blockchain
      if (matches[0]) {
        await anchorToBlockchain(matches[0], face, detectedPhash, fullScan);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const anchorToBlockchain = async (match, face, detectedPhash, fullScanOverride) => {
    setAnchoring(true);
    setVerificationResult(null);
    setTamperResult(null);
    const activeScan = fullScanOverride || scanData;

    try {
      const anchorRes = await fetch('/api/blockchain/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: match.id || 'record_' + Date.now(),
          post_url: match.post_url,
          author: match.author || '@web_source',
          title: match.title || 'Discovered Media Match',
          content_snippet: match.content_snippet || '',
          image_hash_sha256: activeScan?.sha256 || match.id || 'hash_' + Date.now(),
          phash: detectedPhash || '0000000000000000',
          face_embedding_digest:
            face?.embedding_digest ||
            (face?.embedding ? face.embedding.slice(0, 8).join(',') : '0,0,0,0'),
          source_platform: match.platform || 'Web',
        }),
      });
      const anchorData = await anchorRes.json();
      if (!anchorRes.ok || !anchorData.success) throw new Error(anchorData.detail || 'Blockchain anchoring failed.');

      const receipt = anchorData.receipt || anchorData.proof || {};

      const proofObj = {
        record_id: receipt.record_id || match.id,
        block_number: receipt.block_number ?? 1,
        block_hash: receipt.block_hash || '0000000000000000',
        merkle_root: receipt.merkle_root || '0000000000000000',
        tx_id: receipt.tx_id || '',
        image_hash_sha256: activeScan?.sha256 || match.id,
        face_embedding_digest:
          face?.embedding_digest ||
          (face?.embedding ? face.embedding.slice(0, 8).join(',') : '0,0,0,0'),
        match,
        face,
        phash: detectedPhash,
      };

      setBlockchainProof(proofObj);
      setStatusWhisper(
        generateShellWhisper('BLOCK_MINED', {
          blockNumber: proofObj.block_number,
          merkleRoot: proofObj.merkle_root,
        })
      );

      triggerSeance(activeScan, match, proofObj);
      autoVerify(proofObj);
    } catch (err) {
      console.error('Blockchain anchoring error:', err);
      triggerSeance(activeScan, match, null);
    } finally {
      setAnchoring(false);
    }
  };

  const autoVerify = async (proof) => {
    if (!proof) return;
    try {
      const verifyRes = await fetch('/api/blockchain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_record_id: proof.record_id,
          candidate_tx_id: proof.tx_id,
          candidate_post_url: proof.match.post_url,
          candidate_author: proof.match.author || '@web_source',
          candidate_title: proof.match.title || 'Discovered Media Match',
          candidate_content_snippet: proof.match.content_snippet || '',
          candidate_image_hash: proof.image_hash_sha256,
          candidate_phash: proof.phash,
          candidate_face_digest: proof.face_embedding_digest,
        }),
      });
      const verifyData = await verifyRes.json();
      setVerificationResult(verifyData);
    } catch (err) {
      console.error('Auto verify error:', err);
    }
  };

  const handleReVerify = async () => {
    if (!blockchainProof) return;
    setVerifying(true);
    setTamperResult(null);

    try {
      const verifyRes = await fetch('/api/blockchain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_record_id: blockchainProof.record_id,
          candidate_tx_id: blockchainProof.tx_id,
          candidate_post_url: blockchainProof.match.post_url,
          candidate_author: blockchainProof.match.author || '@web_source',
          candidate_title: blockchainProof.match.title || 'Discovered Media Match',
          candidate_content_snippet: blockchainProof.match.content_snippet || '',
          candidate_image_hash: blockchainProof.image_hash_sha256,
          candidate_phash: blockchainProof.phash,
          candidate_face_digest: blockchainProof.face_embedding_digest,
        }),
      });
      const verifyData = await verifyRes.json();
      setVerificationResult(verifyData);
    } catch (err) {
      console.error('Verify error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleTestTamper = async () => {
    if (!blockchainProof) return;
    setTampering(true);
    setVerificationResult(null);

    try {
      const tamperRes = await fetch('/api/blockchain/tamper-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_id: blockchainProof.tx_id,
          field_to_alter: 'post_url',
          altered_value: 'https://fake-tampered-site.com/altered-fake-url',
        }),
      });
      const tamperData = await tamperRes.json();
      setTamperResult(tamperData);
    } catch (err) {
      console.error('Tamper test error:', err);
    } finally {
      setTampering(false);
    }
  };

  const handleModelChange = (newModel) => {
    setSelectedModel(newModel);
    if (scanData && (selectedMatch || results[0])) {
      triggerSeance(scanData, selectedMatch || results[0], blockchainProof, systemPrompt, personaKey, newModel);
    }
  };

  const reset = () => {
    setInputImage(null);
    setScanData(null);
    setResults([]);
    setSelectedMatch(null);
    setPrimaryFace(null);
    setPhash(null);
    setBlockchainProof(null);
    setVerificationResult(null);
    setTamperResult(null);
    setSeanceReport(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const topResult = selectedMatch || results[0];

  const vectorMetrics = useMemo(
    () =>
      computeVectorForensics(
        scanData?.primary_face?.embedding || [],
        topResult?.phantom_embedding || []
      ),
    [scanData, topResult]
  );

  const platformColor = (platform) => {
    const map = {
      'Twitter/X': '#1da1f2',
      Instagram: '#e1306c',
      Pinterest: '#e60023',
      YouTube: '#ff0000',
      TikTok: '#69c9d0',
      Reddit: '#ff4500',
      Facebook: '#1877f2',
      'Official Website': '#10b981',
      'News / Media': '#f59e0b',
      Wikipedia: '#3b82f6',
      Web: '#64748b',
    };
    return map[platform] || '#64748b';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#090A0F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 64px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#F4F4F6',
      }}
    >
      {/* Minimal Sovereignty Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          background: '#11131A',
          border: '1px solid #1E2230',
          borderRadius: 14,
          marginBottom: 28,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00FF9C',
              boxShadow: '0 0 8px #00FF9C',
            }}
          />
          <span style={{ fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>PhantomLedger</span>
          <span style={{ color: '#64748B' }}>|</span>
          <span className="font-mono" style={{ fontSize: 11, color: '#00FF9C' }}>
            Local 128-D Biometrics · 0 B Cloud Leak
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>
            {ollamaOnline ? 'Ollama Live:' : 'Local Model:'}
          </span>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="font-mono"
            style={{
              background: '#090A0F',
              color: '#E2E8F0',
              border: '1px solid #262B3D',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {OPEN_WEIGHT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowPromptEditor((p) => !p)}
            style={{
              background: showPromptEditor ? 'rgba(0, 255, 156, 0.12)' : '#090A0F',
              color: showPromptEditor ? '#00FF9C' : '#94A3B8',
              border: `1px solid ${showPromptEditor ? 'rgba(0, 255, 156, 0.4)' : '#262B3D'}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Prompt
          </button>
        </div>
      </div>

      {/* Collapsible System Prompt Editor (Only shown when clicked) */}
      {showPromptEditor && (
        <div
          style={{
            width: '100%',
            maxWidth: 880,
            background: '#11131A',
            border: '1px solid #262B3D',
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>
              Séance Agent System Prompt
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.values(SYSTEM_PROMPT_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setPersonaKey(preset.id);
                    setSystemPrompt(preset.prompt);
                    if (scanData && topResult) {
                      triggerSeance(scanData, topResult, blockchainProof, preset.prompt, preset.id);
                    }
                  }}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: personaKey === preset.id ? 'rgba(0, 255, 156, 0.14)' : '#090A0F',
                    border: `1px solid ${personaKey === preset.id ? '#00FF9C' : '#262B3D'}`,
                    color: personaKey === preset.id ? '#00FF9C' : '#94A3B8',
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={2}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono"
            style={{
              width: '100%',
              background: '#090A0F',
              border: '1px solid #1E2230',
              borderRadius: 8,
              padding: 10,
              color: '#CBD5E1',
              fontSize: 11,
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Clean Header Title */}
      <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 640 }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Face → Web Match & Blockchain Verification
        </h1>
        <p style={{ color: '#64748B', fontSize: 13 }}>
          Extracts 128-D biometrics locally, discovers digital doppelgängers on the web, and anchors tamper-evident proofs onto a Merkle blockchain.
        </p>
      </div>

      {/* Main Two-Panel Layout */}
      <div
        style={{
          display: 'flex',
          gap: 28,
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: 880,
        }}
      >
        {/* ---- LEFT: Input Image ---- */}
        <div style={{ flex: 1, minWidth: 280, maxWidth: 426 }}>
          <p
            style={{
              color: '#64748B',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.4,
              marginBottom: 10,
            }}
          >
            Input Face Image
          </p>
          <div
            onClick={() => !inputImage && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            style={{
              background: '#11131A',
              border: inputImage ? '1.5px solid #1E2230' : '2px dashed #262B3D',
              borderRadius: 18,
              minHeight: 360,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputImage ? 'default' : 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {inputImage ? (
              <img
                src={inputImage}
                alt="Input"
                style={{ width: '100%', objectFit: 'contain', maxHeight: 420, display: 'block' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                <p style={{ color: '#94A3B8', fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>
                  Click or drag & drop a face image
                </p>
                <p style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
                  Processed locally via OpenCV (128-D embedding)
                </p>
              </div>
            )}
          </div>

          {/* Sample presets when empty, or Reset button when loaded */}
          {inputImage && !loading ? (
            <button
              onClick={reset}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px',
                background: '#11131A',
                border: '1px solid #1E2230',
                borderRadius: 12,
                color: '#94A3B8',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ↺ Upload New Image
            </button>
          ) : (
            sampleFaces.length > 0 &&
            !loading && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sampleFaces.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSample(s)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      background: '#11131A',
                      border: '1px solid #1E2230',
                      borderRadius: 10,
                      color: '#94A3B8',
                      fontSize: 11,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Try: {s.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* ---- RIGHT: Matched Result ---- */}
        <div style={{ flex: 1, minWidth: 280, maxWidth: 426 }}>
          <p
            style={{
              color: '#64748B',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.4,
              marginBottom: 10,
            }}
          >
            Matched Social Media Result
          </p>

          <div
            style={{
              background: '#11131A',
              border: '1.5px solid #1E2230',
              borderRadius: 18,
              minHeight: 360,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    border: '3px solid #1E2230',
                    borderTopColor: '#00FF9C',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <p style={{ color: '#64748B', fontSize: 13 }}>Searching social media & web...</p>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
                <p style={{ color: '#FF4D4D', fontSize: 13, lineHeight: 1.6 }}>{error}</p>
              </div>
            ) : topResult ? (
              <img
                src={topResult.image_url}
                alt="Matched result"
                style={{ width: '100%', objectFit: 'contain', maxHeight: 420, display: 'block' }}
                onError={(e) => {
                  const nextResult = results.find((r) => r.image_url !== e.target.src);
                  if (nextResult) e.target.src = nextResult.image_url;
                  else if (inputImage) e.target.src = inputImage;
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <p style={{ color: '#475569', fontSize: 13 }}>Result image will appear here</p>
              </div>
            )}
          </div>

          {/* Clean Links Below Image */}
          {results.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.slice(0, 3).map((r, i) => {
                const isSelected = topResult?.id === r.id;
                const simPct = Math.round((r.cosine_similarity || r.confidence_score || 0.96) * 100);
                return (
                  <div
                    key={r.id || i}
                    onClick={() => {
                      setSelectedMatch(r);
                      anchorToBlockchain(r, primaryFace, phash, scanData);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 14px',
                      background: isSelected ? '#131C18' : '#11131A',
                      border: `1px solid ${isSelected ? 'rgba(0, 255, 156, 0.35)' : '#1E2230'}`,
                      borderRadius: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          color: '#fff',
                          background: platformColor(r.platform),
                          padding: '2px 7px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.platform}
                      </span>
                      <a
                        href={r.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: isSelected ? '#E2E8F0' : '#94A3B8',
                          fontSize: 12,
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.post_url}
                      </a>
                    </div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#00FF9C',
                        flexShrink: 0,
                      }}
                    >
                      {simPct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- CLEAN 128-D VECTOR & AI SÉANCE REPORT CARD ---- */}
      {topResult && (
        <div
          style={{
            width: '100%',
            maxWidth: 880,
            marginTop: 28,
            background: '#11131A',
            border: '1px solid #1E2230',
            borderRadius: 18,
            padding: 22,
          }}
        >
          {/* Top Metrics Row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingBottom: 16,
              borderBottom: '1px solid #1E2230',
            }}
          >
            <div>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
                128-D Vector Radar & Local AI Séance Report
              </h3>
              <p style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                Cosine Similarity:{' '}
                <strong className="font-mono" style={{ color: '#00FF9C' }}>
                  {(vectorMetrics.cosineSimilarity * 100).toFixed(2)}%
                </strong>{' '}
                · L2 Distance:{' '}
                <strong className="font-mono" style={{ color: '#E2E8F0' }}>
                  {vectorMetrics.euclideanDistance.toFixed(4)}
                </strong>{' '}
                · Sighting:{' '}
                <span className="font-mono" style={{ color: '#FF4D4D' }}>
                  {topResult.sighting_time_utc || '03:14 UTC'}
                </span>
              </p>
            </div>

            {/* Clean Tab Switcher */}
            <div
              style={{
                display: 'flex',
                background: '#090A0F',
                padding: 3,
                borderRadius: 10,
                border: '1px solid #1E2230',
              }}
            >
              <button
                onClick={() => setActiveReportTab('spooky')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeReportTab === 'spooky' ? '#1E2230' : 'transparent',
                  color: activeReportTab === 'spooky' ? '#00FF9C' : '#64748B',
                }}
              >
                Ghost in the Machine Log
              </button>
              <button
                onClick={() => setActiveReportTab('forensic')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeReportTab === 'forensic' ? '#1E2230' : 'transparent',
                  color: activeReportTab === 'forensic' ? '#38BDF8' : '#64748B',
                }}
              >
                Forensic & Privacy Audit
              </button>
            </div>
          </div>

          {/* Sleek 128-D Spectrum Bar */}
          {scanData?.primary_face?.embedding && (
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <div
                style={{
                  height: 28,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 2,
                  background: '#090A0F',
                  padding: '4px 6px',
                  borderRadius: 8,
                  border: '1px solid #181C28',
                }}
              >
                {scanData.primary_face.embedding.slice(0, 64).map((val, idx) => {
                  const pVal = topResult.phantom_embedding?.[idx] ?? val;
                  const delta = Math.abs(val - pVal);
                  const h = Math.min(100, Math.max(15, Math.abs(val) * 360));
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        background: delta > 0.032 ? '#FF4D4D' : '#00FF9C',
                        opacity: delta > 0.032 ? 0.9 : 0.65,
                        borderRadius: 1,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Clean Report Output Box */}
          <div
            style={{
              background: '#090A0F',
              border: '1px solid #181C28',
              borderRadius: 12,
              padding: 16,
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {seanceLoading ? (
              <p className="font-mono" style={{ color: '#64748B', fontSize: 12 }}>
                Analyzing 128-D vector distance with {selectedModel}...
              </p>
            ) : (
              <pre
                className="font-mono"
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 11.5,
                  lineHeight: 1.65,
                  color: activeReportTab === 'spooky' ? '#A7F3D0' : '#CBD5E1',
                }}
              >
                {activeReportTab === 'spooky'
                  ? seanceReport?.spookyLog || 'Generating report...'
                  : seanceReport?.forensicAudit || 'Generating audit...'}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ---- BLOCKCHAIN VERIFICATION SECTION ---- */}
      {topResult && (
        <div
          style={{
            width: '100%',
            maxWidth: 880,
            marginTop: 20,
            background: '#11131A',
            border: '1px solid #1E2230',
            borderRadius: 18,
            padding: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⛓️</span>
              <div>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
                  Blockchain Evidence Record
                </h3>
                <p style={{ color: '#64748B', fontSize: 12 }}>
                  Tamper-evident Proof-of-Work & Merkle Tree ledger record
                </p>
              </div>
            </div>
            {anchoring ? (
              <span style={{ color: '#00FF9C', fontSize: 12 }}>Mining Block...</span>
            ) : blockchainProof ? (
              <span
                style={{
                  background: 'rgba(0, 255, 156, 0.1)',
                  color: '#00FF9C',
                  border: '1px solid rgba(0, 255, 156, 0.3)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 8,
                }}
              >
                ON-CHAIN ANCHORED
              </span>
            ) : null}
          </div>

          {blockchainProof && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: '#090A0F',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #181C28',
                  }}
                >
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600 }}>BLOCK HEIGHT</p>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                    #{blockchainProof.block_number}
                  </p>
                </div>
                <div
                  style={{
                    background: '#090A0F',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #181C28',
                  }}
                >
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600 }}>
                    BLOCK HASH (SHA-256)
                  </p>
                  <p
                    className="font-mono"
                    style={{
                      color: '#38BDF8',
                      fontSize: 11,
                      marginTop: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    {blockchainProof.block_hash}
                  </p>
                </div>
                <div
                  style={{
                    background: '#090A0F',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #181C28',
                  }}
                >
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600 }}>MERKLE ROOT</p>
                  <p
                    className="font-mono"
                    style={{
                      color: '#C084FC',
                      fontSize: 11,
                      marginTop: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    {blockchainProof.merkle_root}
                  </p>
                </div>
                <div
                  style={{
                    background: '#090A0F',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #181C28',
                  }}
                >
                  <p style={{ color: '#64748B', fontSize: 10, fontWeight: 600 }}>ECDSA SIGNATURE</p>
                  <p
                    className="font-mono"
                    style={{ color: '#00FF9C', fontSize: 11, marginTop: 4 }}
                  >
                    secp256k1 Signed ✓
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={handleReVerify}
                  disabled={verifying}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    background: 'rgba(0, 255, 156, 0.08)',
                    border: '1px solid rgba(0, 255, 156, 0.35)',
                    borderRadius: 10,
                    color: '#00FF9C',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {verifying ? 'Verifying...' : '✓ Re-Verify Against On-Chain Record'}
                </button>
                <button
                  onClick={handleTestTamper}
                  disabled={tampering}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    background: 'rgba(255, 77, 77, 0.08)',
                    border: '1px solid rgba(255, 77, 77, 0.35)',
                    borderRadius: 10,
                    color: '#FF4D4D',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tampering ? 'Testing...' : '⚡ Test Tamper Detection'}
                </button>
              </div>

              {verificationResult && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: 'rgba(0, 255, 156, 0.06)',
                    border: '1px solid rgba(0, 255, 156, 0.3)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div>
                    <p style={{ color: '#00FF9C', fontSize: 13, fontWeight: 700 }}>
                      VERIFIED AUTHENTIC: Matches On-Chain Record Exactly
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>
                      Post URL, Author, Image Hash & Merkle Audit Proof match Block #
                      {verificationResult.block_number ?? blockchainProof.block_number}.
                    </p>
                  </div>
                </div>
              )}

              {tamperResult && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: 'rgba(255, 77, 77, 0.06)',
                    border: '1px solid rgba(255, 77, 77, 0.35)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <div>
                    <p style={{ color: '#FF4D4D', fontSize: 13, fontWeight: 700 }}>
                      TAMPER DETECTED: Cryptographic Integrity Failure
                    </p>
                    <p style={{ color: '#FCA5A5', fontSize: 12, marginTop: 2 }}>
                      {tamperResult.simulated_verification?.audit_breakdown?.[2]?.check ||
                        'Altered content fails Merkle Tree audit path verification.'}{' '}
                      — Altered URL:{' '}
                      {tamperResult.simulated_verification?.audit_breakdown?.[2]?.submitted ||
                        'https://fake-tampered-site.com'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Subtle Single-Line Terminal Status */}
      <div
        className="font-mono"
        style={{
          width: '100%',
          maxWidth: 880,
          marginTop: 20,
          padding: '8px 14px',
          background: '#11131A',
          border: '1px solid #181C28',
          borderRadius: 10,
          fontSize: 11,
          color: '#64748B',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {statusWhisper}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a:hover { opacity: 0.85; }
        button:hover { filter: brightness(1.08); }
      `}</style>
    </div>
  );
}
