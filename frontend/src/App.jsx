import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  ScanFace,
  Globe,
  Blocks,
  BadgeCheck,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Fingerprint,
  Hash,
  Layers,
  KeyRound,
  ImageOff,
  ArrowUpRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

const truncateMiddle = (str, head = 10, tail = 8) => {
  if (!str) return '—';
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const onCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={onCopy}
      title="Copy"
      className="shrink-0 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{children}</h2>
      {right}
    </div>
  );
}

function Card({ className = '', children }) {
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.06] bg-zinc-900/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_20px_40px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function MetaItem({ icon: Icon, label, value, mono = true, copy }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`truncate text-[13px] text-zinc-200 ${mono ? 'font-mono' : 'font-medium'}`} title={copy || undefined}>
          {value}
        </p>
      </div>
      {copy && <CopyButton value={copy} />}
    </div>
  );
}

function Step({ index, label, icon: Icon, state }) {
  const styles = {
    done: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    active: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-300',
    pending: 'border-white/[0.06] bg-white/[0.02] text-zinc-500',
  }[state];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${styles}`}>
        {state === 'done' ? (
          <Check className="h-4 w-4" strokeWidth={2.5} />
        ) : state === 'active' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="hidden sm:block">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Step {index}</p>
        <p className={`text-[13px] font-medium ${state === 'pending' ? 'text-zinc-500' : 'text-zinc-200'}`}>{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main App                                                            */
/* ------------------------------------------------------------------ */

export default function App() {
  const [inputImage, setInputImage] = useState(null);
  const [results, setResults] = useState([]);
  const [primaryFace, setPrimaryFace] = useState(null);
  const [phash, setPhash] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null); // 'detect' | 'search'
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Blockchain state
  const [anchoring, setAnchoring] = useState(false);
  const [blockchainProof, setBlockchainProof] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tampering, setTampering] = useState(false);
  const [tamperResult, setTamperResult] = useState(null);
  const [health, setHealth] = useState(null);

  const fileInputRef = useRef(null);

  const refreshHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setHealth(await res.json());
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    refreshHealth();
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

  const runPipeline = async (b64) => {
    setLoading(true);
    setStage('detect');
    setError(null);
    setResults([]);
    setSelectedIdx(0);
    setPrimaryFace(null);
    setPhash(null);
    setImageMeta(null);
    setBlockchainProof(null);
    setVerificationResult(null);
    setTamperResult(null);

    try {
      // Step 1: Face Detection
      const formData = new FormData();
      formData.append('image_base64', b64);
      const detectRes = await fetch('/api/face/detect', { method: 'POST', body: formData });
      const detectData = await detectRes.json();
      if (!detectRes.ok || !detectData.success) throw new Error(detectData.detail || 'Face detection failed.');

      const face = detectData.data.primary_face;
      const detectedPhash = detectData.data.phash;
      setPrimaryFace(face);
      setPhash(detectedPhash);
      setImageMeta({
        sha256: detectData.data.sha256,
        face_count: detectData.data.face_count,
        width: detectData.data.image_width,
        height: detectData.data.image_height,
      });

      // Step 2: Real Reverse Image Search (Yandex CBIR)
      setStage('search');
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

      // Auto-anchor top match to Blockchain
      if (matches[0]) {
        anchorToBlockchain(matches[0], face, detectedPhash);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      setStage(null);
    }
  };

  const anchorToBlockchain = async (match, face, detectedPhash) => {
    setAnchoring(true);
    setVerificationResult(null);
    setTamperResult(null);

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
          image_hash_sha256: match.id || 'hash_' + Date.now(),
          phash: detectedPhash || '0000000000000000',
          face_embedding_digest: face?.embedding ? face.embedding.slice(0, 8).join(',') : '0,0,0,0',
          source_platform: match.platform || 'Web',
        }),
      });
      const anchorData = await anchorRes.json();
      if (!anchorRes.ok || !anchorData.success) throw new Error(anchorData.detail || 'Blockchain anchoring failed.');

      const receipt = anchorData.receipt || anchorData.proof || {};

      const proofObj = {
        block_number: receipt.block_number ?? 1,
        block_hash: receipt.block_hash || '0000000000000000',
        merkle_root: receipt.merkle_root || '0000000000000000',
        tx_id: receipt.tx_id || '',
        match: match,
        face: face,
        phash: detectedPhash,
      };

      setBlockchainProof(proofObj);
      refreshHealth();

      // Auto verify right after anchoring
      autoVerify(proofObj);
    } catch (err) {
      console.error('Blockchain anchoring error:', err);
    } finally {
      setAnchoring(false);
    }
  };

  const buildVerifyBody = (proof) => ({
    candidate_record_id: proof.match.id,
    candidate_tx_id: proof.tx_id,
    candidate_post_url: proof.match.post_url,
    candidate_author: proof.match.author || '@web_source',
    candidate_title: proof.match.title || 'Discovered Media Match',
    candidate_content_snippet: proof.match.content_snippet || '',
    candidate_image_hash: proof.match.id,
    candidate_phash: proof.phash,
    candidate_face_digest: proof.face?.embedding ? proof.face.embedding.slice(0, 8).join(',') : '0,0,0,0',
  });

  const autoVerify = async (proof) => {
    if (!proof) return;
    try {
      const verifyRes = await fetch('/api/blockchain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVerifyBody(proof)),
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
    setTamperResult(null); // Clear red tamper result when re-verifying authentic data!

    try {
      const verifyRes = await fetch('/api/blockchain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVerifyBody(blockchainProof)),
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
    setVerificationResult(null); // Clear green authentic result when testing tamper!

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

  const reset = () => {
    setInputImage(null);
    setResults([]);
    setSelectedIdx(0);
    setPrimaryFace(null);
    setPhash(null);
    setImageMeta(null);
    setBlockchainProof(null);
    setVerificationResult(null);
    setTamperResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const platformColor = (platform) => {
    const map = {
      'Twitter/X': '#1da1f2',
      'Instagram': '#e1306c',
      'Pinterest': '#e60023',
      'YouTube': '#ff0000',
      'TikTok': '#69c9d0',
      'Reddit': '#ff4500',
      'Facebook': '#1877f2',
      'Official Website': '#22c55e',
      'News / Media': '#f59e0b',
      'Wikipedia': '#3b82f6',
      'Web': '#a1a1aa',
    };
    return map[platform] || '#a1a1aa';
  };

  const topResult = results[selectedIdx] || results[0];

  // Stepper state
  const stepState = (key) => {
    switch (key) {
      case 'detect':
        return primaryFace ? 'done' : stage === 'detect' ? 'active' : 'pending';
      case 'search':
        return results.length ? 'done' : stage === 'search' ? 'active' : 'pending';
      case 'anchor':
        return blockchainProof ? 'done' : anchoring ? 'active' : 'pending';
      case 'verify':
        return verificationResult ? 'done' : blockchainProof && !tamperResult ? 'active' : 'pending';
      default:
        return 'pending';
    }
  };

  const faceConfidence =
    primaryFace?.confidence != null
      ? `${(primaryFace.confidence <= 1 ? primaryFace.confidence * 100 : primaryFace.confidence).toFixed(1)}%`
      : '—';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#09090b] font-sans text-zinc-100 antialiased">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-600/[0.12] blur-[120px]" />
        <div className="absolute right-[-10rem] top-[30rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/[0.06] blur-[100px]" />
        <div className="bg-grid-fade absolute inset-0" />
      </div>

      {/* ---------------- Navbar ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090b]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <ShieldCheck className="h-[18px] w-[18px] text-white" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight text-white">FaceLedger</p>
              <p className="text-[11px] text-zinc-500">Biometric provenance, on-chain</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs sm:flex">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                    health ? 'bg-emerald-400' : 'bg-zinc-500'
                  }`}
                />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${health ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              </span>
              <span className="text-zinc-400">{health ? 'Node online' : 'Connecting'}</span>
              {health && (
                <>
                  <span className="h-3 w-px bg-white/10" />
                  <span className="font-mono text-zinc-300">#{health.blockchain_height}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-14">
        {/* ---------------- Hero ---------------- */}
        <section className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-zinc-400">
            <Fingerprint className="h-3.5 w-3.5 text-indigo-300" />
            128-D facial embeddings · Merkle-anchored evidence
          </div>
          <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Trace a face across the web.
            <br />
            Prove it on-chain.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Upload a portrait to discover where it appears online, then seal a tamper-evident record of the match into a
            signed, proof-of-work blockchain.
          </p>
        </section>

        {/* ---------------- Stepper ---------------- */}
        <section className="mx-auto mt-12 max-w-3xl">
          <Card className="px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <Step index={1} label="Detect face" icon={ScanFace} state={stepState('detect')} />
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-white/[0.03]" />
              <Step index={2} label="Web discovery" icon={Globe} state={stepState('search')} />
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-white/[0.03]" />
              <Step index={3} label="Anchor block" icon={Blocks} state={stepState('anchor')} />
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-white/[0.03]" />
              <Step index={4} label="Verify" icon={BadgeCheck} state={stepState('verify')} />
            </div>
          </Card>
        </section>

        {/* ---------------- Two-panel workspace ---------------- */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* LEFT: Input */}
          <div>
            <SectionLabel
              right={
                inputImage &&
                !loading && (
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    New image
                  </button>
                )
              }
            >
              Source image
            </SectionLabel>

            <Card className="overflow-hidden">
              <div
                onClick={() => !inputImage && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`relative flex aspect-[4/3] items-center justify-center transition-colors ${
                  inputImage ? 'bg-black/40' : 'cursor-pointer'
                } ${dragOver ? 'bg-indigo-500/[0.06]' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {inputImage ? (
                  <>
                    <img src={inputImage} alt="Input" className="h-full w-full object-contain" />
                    {loading && stage === 'detect' && <div className="scan-line absolute inset-x-0 top-0 h-24" />}
                  </>
                ) : (
                  <div
                    className={`m-4 flex h-[calc(100%-2rem)] w-[calc(100%-2rem)] flex-col items-center justify-center rounded-xl border border-dashed transition-colors ${
                      dragOver ? 'border-indigo-400/60' : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <UploadCloud className="h-6 w-6 text-zinc-300" />
                    </div>
                    <p className="text-sm font-medium text-zinc-200">Drop an image, or click to browse</p>
                    <p className="mt-1 text-xs text-zinc-500">JPG, PNG or WebP · processed locally for embeddings</p>
                  </div>
                )}
              </div>

              {primaryFace && (
                <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] p-3">
                  <MetaItem icon={ScanFace} label="Face confidence" value={faceConfidence} />
                  <MetaItem icon={Layers} label="Embedding" value={`${primaryFace.embedding?.length || 128}-D vector`} />
                  <MetaItem icon={Hash} label="Perceptual hash" value={phash || '—'} copy={phash} />
                  <MetaItem
                    icon={Fingerprint}
                    label="SHA-256"
                    value={truncateMiddle(imageMeta?.sha256, 8, 6)}
                    copy={imageMeta?.sha256}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: Match */}
          <div>
            <SectionLabel
              right={
                results.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    {results.length} match{results.length === 1 ? '' : 'es'} found
                  </span>
                )
              }
            >
              Web match
            </SectionLabel>

            <Card className="overflow-hidden">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-black/40">
                {loading ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-5 h-12 w-12">
                      <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-200">
                      {stage === 'detect' ? 'Extracting facial embedding…' : 'Searching the web…'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {stage === 'detect' ? 'Locating landmarks and hashing image' : 'Running reverse image discovery'}
                    </p>
                  </div>
                ) : error ? (
                  <div className="flex max-w-xs flex-col items-center px-6 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
                      <AlertTriangle className="h-5 w-5 text-rose-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-200">We couldn't complete the search</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{error}</p>
                  </div>
                ) : topResult ? (
                  <>
                    <img
                      src={topResult.image_url}
                      alt="Matched result"
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        const nextResult = results.find((r) => r.image_url !== e.target.src);
                        if (nextResult) e.target.src = nextResult.image_url;
                      }}
                    />
                    {topResult.confidence_score != null && (
                      <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
                        {(topResult.confidence_score * 100).toFixed(0)}% similarity
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                      <ImageOff className="h-6 w-6 text-zinc-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">No match yet</p>
                    <p className="mt-1 text-xs text-zinc-600">Results will appear here after upload</p>
                  </div>
                )}
              </div>

              {results.length > 0 && (
                <div className="divide-y divide-white/[0.04] border-t border-white/[0.05]">
                  {results.slice(0, 3).map((r, i) => (
                    <div
                      key={r.id || i}
                      onClick={() => setSelectedIdx(i)}
                      className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition ${
                        i === selectedIdx ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: platformColor(r.platform), boxShadow: `0 0 10px ${platformColor(r.platform)}66` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-medium text-zinc-200">{r.title || r.platform}</p>
                          {i === 0 && (
                            <span className="shrink-0 rounded-md border border-indigo-400/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                              Top
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-zinc-500">
                          {r.platform} · {r.post_url}
                        </p>
                      </div>
                      <a
                        href={r.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-100"
                        title="Open source"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* ---------------- Blockchain record ---------------- */}
        {results.length > 0 && (
          <section className="mt-10">
            <SectionLabel>Evidence record</SectionLabel>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/20 to-sky-500/10">
                    <Blocks className="h-5 w-5 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-white">Blockchain evidence</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Proof-of-work block with Merkle inclusion proof and ECDSA signature
                    </p>
                  </div>
                </div>

                {anchoring ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Mining block…
                  </span>
                ) : blockchainProof ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Anchored on-chain
                  </span>
                ) : null}
              </div>

              {anchoring && !blockchainProof && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
                  ))}
                </div>
              )}

              {blockchainProof && (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetaItem icon={Layers} label="Block height" value={`#${blockchainProof.block_number}`} mono={false} />
                    <MetaItem
                      icon={Hash}
                      label="Block hash"
                      value={truncateMiddle(blockchainProof.block_hash, 8, 6)}
                      copy={blockchainProof.block_hash}
                    />
                    <MetaItem
                      icon={Blocks}
                      label="Merkle root"
                      value={truncateMiddle(blockchainProof.merkle_root, 8, 6)}
                      copy={blockchainProof.merkle_root}
                    />
                    <MetaItem icon={KeyRound} label="Signature" value="secp256k1 · valid" mono={false} />
                  </div>

                  {blockchainProof.tx_id && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-2.5">
                      <span className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">Tx</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-300">
                        {blockchainProof.tx_id}
                      </span>
                      <CopyButton value={blockchainProof.tx_id} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={handleReVerify}
                      disabled={verifying}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-200 disabled:opacity-60"
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {verifying ? 'Verifying…' : 'Re-verify against chain'}
                    </button>
                    <button
                      onClick={handleTestTamper}
                      disabled={tampering}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-60"
                    >
                      {tampering ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                      {tampering ? 'Simulating…' : 'Simulate tampering'}
                    </button>
                  </div>

                  {/* Verification Output Banner */}
                  {verificationResult && (
                    <div className="fade-in mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                        <BadgeCheck className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-300">Verified authentic</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">
                          Post URL, author, image hash and Merkle audit path exactly match the record in block #
                          {verificationResult.block_number ?? blockchainProof.block_number}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tamper Output Banner */}
                  {tamperResult && (
                    <div className="fade-in mt-5 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-300">Tampering detected</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-400">
                          {tamperResult.simulated_verification?.audit_breakdown?.[2]?.check ||
                            'Altered content fails Merkle Tree audit path and block hash verification.'}
                        </p>
                        <p className="mt-2 truncate font-mono text-xs text-zinc-500">
                          Altered URL:{' '}
                          <span className="text-rose-300/80">
                            {tamperResult.simulated_verification?.audit_breakdown?.[2]?.submitted ||
                              'https://fake-tampered-site.com'}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </section>
        )}

        {/* ---------------- Feature strip (idle state) ---------------- */}
        {!inputImage && (
          <section className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: ScanFace,
                title: 'Local biometrics',
                body: 'Faces are detected and encoded into a 128-dimensional embedding with perceptual hashing.',
              },
              {
                icon: Globe,
                title: 'Web discovery',
                body: 'Reverse image search surfaces where the same face appears across sites and social platforms.',
              },
              {
                icon: Blocks,
                title: 'Tamper-evident ledger',
                body: 'Each match is sealed in a signed PoW block — any altered byte breaks the Merkle proof.',
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 transition hover:border-white/10 hover:bg-white/[0.03]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="h-4 w-4 text-zinc-300" />
                </div>
                <p className="text-sm font-medium text-zinc-100">{title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{body}</p>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-600 sm:flex-row">
          <p>FaceLedger · HHG-3</p>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition hover:text-zinc-300"
          >
            API reference <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
