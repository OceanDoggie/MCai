import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Settings, Home, Zap, Sun, Pause, Play, SkipBack, SkipForward, CheckCircle2, MessageSquare, Timer, Smartphone, Aperture, ChevronRight, ChevronLeft, Mic, Send, Sparkles, User, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { useUIStore } from '../store/useUIStore';
import { useLivePoseStore } from '../store/useLivePoseStore';
import { detectPose, initPoseDetector } from '../utils/mediaPipeService';
import { PoseCategory } from '../types';
import { useLiveSession } from '../hooks/useLiveSession';
import { PoseOverlay } from '../components/PoseOverlay';

export const CameraView: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const requestRef = useRef<number | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [playMode, setPlayMode] = useState<'loop' | 'shuffle'>('loop');
    const [isPlaying, setIsPlaying] = useState(true);
    const [isFlashing, setIsFlashing] = useState(false);

    const [zoomLevel, setZoomLevel] = useState(1);
    const [userQuestion, setUserQuestion] = useState('');
    const [isInputFocused, setIsInputFocused] = useState(false);

    const [cameraMode, setCameraMode] = useState<'detail' | 'broadcast'>('detail');
    const [shutterMode, setShutterMode] = useState<'auto' | 'manual'>('manual');
    const [shootingMode, setShootingMode] = useState<'photographer' | 'selfie'>('photographer');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const { playlist } = usePlaylistStore();
    const { setView, addPhoto, gallery, showToast, currentView } = useUIStore();
    const { currentLivePose, setCurrentLivePose } = useLivePoseStore();

    // [NEW] Live Session Hook
    const { status: liveStatus, connect: connectLive, disconnect: disconnectLive, sendExactFrame } = useLiveSession();

    const activePose = playlist[activeIndex];
    const lastPhoto = gallery.length > 0 ? gallery[gallery.length - 1] : null;

    const lastFrameTime = useRef(0);

    const feetWarning = useMemo(() => {
        if (!currentLivePose || !activePose) return false;
        if (activePose.category === PoseCategory.FULL_BODY) {
            const feetIndices = [27, 28, 29, 30, 31, 32];
            const feetLandmarks = feetIndices.map(i => currentLivePose[i]);
            const validPoints = feetLandmarks.filter(lm => lm && lm.visibility !== undefined && lm.visibility > 0.5);
            return validPoints.length < 2;
        }
        return false;
    }, [currentLivePose, activePose]);

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (playlist.length === 0) return;
        setActiveIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    };

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (playlist.length === 0) return;
        if (playMode === 'shuffle') {
            let nextIndex = Math.floor(Math.random() * playlist.length);
            if (playlist.length > 1 && nextIndex === activeIndex) nextIndex = (nextIndex + 1) % playlist.length;
            setActiveIndex(nextIndex);
        } else setActiveIndex((prev) => (prev + 1) % playlist.length);
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPlaying(!isPlaying);
    };

    const handleShutter = () => {
        if (!videoRef.current) return;
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (shootingMode === 'selfie') {
                    ctx.translate(canvas.width, 0);
                    ctx.scale(-1, 1);
                }
                ctx.drawImage(videoRef.current, 0, 0);
                addPhoto(canvas.toDataURL('image/jpeg', 0.8));
                showToast("Photo saved!"); // [NEW] Toast instead of View change
            }
        } catch (e) { console.error("Capture failed", e); }
        if (playlist.length > 1 && isPlaying) handleNext();
    };

    const handleAskAI = (e: React.FormEvent) => {
        e.preventDefault();
        // In Live Mode, user just talks. This is fallback text input.
        if (!userQuestion.trim()) return;
        // TODO: Send text to backend via hook if supported
        console.log("Text input not yet linked to backend text channel");
        setUserQuestion('');
        setIsInputFocused(false);
    };

    const handleFinish = () => {
        disconnectLive();
        setView('result');
    };

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50) setIsSidebarOpen(false);
        if (distance < -50) setIsSidebarOpen(true);
    };

    useEffect(() => {
        const el = document.getElementById(`playlist-item-${activeIndex}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activeIndex]);

    useEffect(() => { initPoseDetector().catch(console.error); }, []);

    // [NEW] Main Loop: Pose Detection + Video Streaming
    // [NEW] Main Loop: Pose Detection + Video Streaming
    // Live Session Hook

    useEffect(() => {
        // Privacy Guard: If not on camera view, stop everything.
        if (currentView !== 'camera') {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            return;
        }

        let stream: MediaStream | null = null;
        let animationFrameId: number;

        const animate = () => {
            const now = performance.now();

            if (videoRef.current && videoRef.current.readyState >= 2) {
                // 1. Detect Pose (Local)
                const result = detectPose(videoRef.current, now);
                if (result && result.landmarks && result.landmarks.length > 0) setCurrentLivePose(result.landmarks[0]);
                else setCurrentLivePose(null);

                // 2. Send Frame to AI (~1 FPS)
                if (liveStatus === 'connected' && now - lastFrameTime.current > 1000) {
                    lastFrameTime.current = now;
                    try {
                        const canvas = document.createElement('canvas');
                        // Downscale for speed/bandwidth
                        canvas.width = 640;
                        canvas.height = 360; // 16:9
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                            const base64 = canvas.toDataURL('image/jpeg', 0.5);
                            sendExactFrame(base64);
                        }
                    } catch (e) {
                        console.error("Frame send error", e);
                    }
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        const startCamera = async () => {
            try {
                const facingMode = shootingMode === 'selfie' ? 'user' : 'environment';
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false, // Audio handled by useLiveSession (AudioContext)
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadeddata = () => { cancelAnimationFrame(animationFrameId); animationFrameId = requestAnimationFrame(animate); };
                }
            } catch (err) { setStreamError("Unable to access camera."); }
        };

        startCamera();

        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            cancelAnimationFrame(animationFrameId);
        };
    }, [setCurrentLivePose, shootingMode, liveStatus, sendExactFrame, currentView]);

    return (
        <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans" onClick={() => { setIsSettingsOpen(false); setIsInputFocused(false); }}>
            <div className={`absolute inset-0 z-50 bg-white pointer-events-none transition-opacity duration-150 ${isFlashing ? 'opacity-80' : 'opacity-0'}`} />

            {/* --- CONNECT OVERLAY (Start Call) --- */}
            {liveStatus === 'disconnected' && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                    <div className="mb-6 w-20 h-20 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                        <Mic size={40} className="text-mcai-accent" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Start AI Session</h2>
                    <p className="text-white/60 text-sm mb-8 max-w-xs">Connecting to Gemini Live. Please allow microphone access.</p>
                    <button
                        onClick={connectLive}
                        className="bg-mcai-accent text-black font-bold py-3 px-8 rounded-full text-lg shadow-[0_0_20px_rgba(242,169,59,0.4)] hover:scale-105 transition-transform"
                    >
                        Start Call
                    </button>
                </div>
            )}

            {/* Video Feed */}
            {!streamError && (
                <div className="absolute inset-0 overflow-hidden bg-black">
                    <video ref={videoRef} autoPlay playsInline muted
                        style={{ transform: `scale(${zoomLevel}) ${shootingMode === 'selfie' ? 'scaleX(-1)' : ''}`, transition: 'transform 0.3s ease' }}
                        className="w-full h-full object-cover" />
                </div>
            )}

            {/* Grid Lines */}
            <div className="absolute inset-0 pointer-events-none opacity-20 z-10">
                <div className="w-full h-full border-x border-white/30 grid grid-cols-3 grid-rows-3">
                    {[...Array(9)].map((_, i) => <div key={i} className="border border-white/30" />)}
                </div>
            </div>

            <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">

                {/* --- TOP STATUS BAR --- */}
                <div className="bg-gradient-to-b from-black/80 to-transparent pt-4 pb-16 px-4 flex justify-between items-start pointer-events-auto relative z-30">
                    <div className="flex flex-col items-start gap-2 w-24">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setView('home')} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"><Home size={20} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }} className={`p-2 rounded-full backdrop-blur-md transition-all ${isSettingsOpen ? 'bg-mcai-accent text-black rotate-90' : 'bg-white/10 text-white hover:bg-white/20'}`}><Settings size={20} /></button>
                        </div>
                        {isSettingsOpen && (
                            <div className="mt-2 bg-[#1C1C1E]/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex flex-col gap-3 min-w-[170px] shadow-2xl animate-in slide-in-from-top-2">
                                <div onClick={(e) => { e.stopPropagation(); setShutterMode(m => m === 'auto' ? 'manual' : 'auto'); }} className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-2 text-white/80 group-hover:text-white"><Timer size={14} /><span className="text-xs font-medium">Auto Shutter</span></div>
                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${shutterMode === 'auto' ? 'bg-mcai-accent' : 'bg-white/20'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${shutterMode === 'auto' ? 'left-[18px]' : 'left-0.5'}`} /></div>
                                </div>
                                <div onClick={(e) => { e.stopPropagation(); setShootingMode(m => m === 'selfie' ? 'photographer' : 'selfie'); }} className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-2 text-white/80 group-hover:text-white">{shootingMode === 'selfie' ? <User size={14} /> : <Smartphone size={14} />}<span className="text-xs font-medium">{shootingMode === 'selfie' ? 'Selfie' : 'Rear Cam'}</span></div>
                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${shootingMode === 'selfie' ? 'bg-mcai-accent' : 'bg-white/20'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${shootingMode === 'selfie' ? 'left-[18px]' : 'left-0.5'}`} /></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex bg-black/40 backdrop-blur-xl rounded-full p-1 border border-white/10 absolute left-1/2 -translate-x-1/2 top-4">
                        <button onClick={() => setCameraMode('detail')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${cameraMode === 'detail' ? 'bg-mcai-accent text-black' : 'text-white/60'}`}>DETAIL</button>
                        <button onClick={() => setCameraMode('broadcast')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${cameraMode === 'broadcast' ? 'bg-mcai-accent text-black' : 'text-white/60'}`}>LIVE BODY</button>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-24">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors ${liveStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${liveStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[9px] font-bold">{liveStatus === 'connected' ? 'LIVE' : 'OFFLINE'}</span>
                        </div>
                        {liveStatus === 'connecting' && <span className="text-[9px] text-white/60 animate-pulse">Connecting...</span>}
                    </div>
                </div>

                {activePose && (
                    <>
                        {/* [NEW] Visual Guide Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <PoseOverlay pose={activePose} />
                        </div>

                        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-[280px] pointer-events-none z-20">
                            <div className="text-center">
                                <p className="text-white text-lg font-bold tracking-tight drop-shadow-lg italic">"{activePose.tips?.[0]}"</p>
                            </div>
                        </div>
                    </>
                )}

                {/* --- MIDDLE SECTION --- */}
                <div className="flex-1 flex justify-between px-2 py-4 relative pointer-events-none overflow-hidden">

                    {/* LEFT SIDEBAR (Pose Guide + Playlist) */}
                    <div className={`absolute top-4 left-2 bottom-4 w-20 flex flex-col pointer-events-auto z-40 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

                        {/* Pose Guide Icon moved above playlist */}
                        <div className="bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 p-2 text-center mb-3">
                            <div className="w-8 h-8 mx-auto border-2 border-white rounded-full mb-1 flex items-center justify-center bg-white/5"><div className="w-0.5 h-3 bg-white relative top-0.5"></div></div>
                            <span className="text-[7px] text-mcai-accent font-black tracking-widest uppercase">Pose Guide</span>
                        </div>

                        <div className="flex-1 flex flex-col bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 p-2 mask-linear-fade-bottom">
                                {playlist.map((item, index) => (
                                    <div id={`playlist-item-${index}`} key={item.instanceId} onClick={() => setActiveIndex(index)} className={`relative aspect-[3/4] rounded-lg overflow-hidden transition-all duration-300 border ${index === activeIndex ? 'border-mcai-accent ring-2 ring-mcai-accent/50 z-10' : 'border-white/10 opacity-50 grayscale'}`}><img src={item.imageSrc} className="w-full h-full object-cover" alt="" /><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold ${index === activeIndex ? 'bg-mcai-accent text-black' : 'bg-black/50 text-white'}`}>{index + 1}</div></div>
                                ))}
                            </div>
                            {playlist.length > 0 && (
                                <div className="bg-black/80 backdrop-blur-xl p-2 flex flex-col gap-2 border-t border-white/10">
                                    <div className="flex justify-between items-center text-white/80"><button onClick={handlePrev} className="p-1"><SkipBack size={14} /></button><button onClick={togglePlay} className="text-mcai-accent p-1 bg-white/10 rounded-full">{isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button><button onClick={handleNext} className="p-1"><SkipForward size={14} /></button></div>
                                    <button onClick={() => setPlayMode(m => m === 'loop' ? 'shuffle' : 'loop')} className="py-1.5 rounded-lg bg-white/5 text-[9px] font-bold uppercase text-white/60">{playMode === 'loop' ? 'Seq' : 'Ran'}</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isSidebarOpen && playlist.length > 0 && (
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 z-40 pointer-events-auto pl-1 pr-3 py-6 bg-black/40 backdrop-blur-md rounded-r-xl border border-white/10 cursor-pointer" onClick={() => setIsSidebarOpen(true)}><ChevronRight size={20} className="text-mcai-accent" /></div>
                    )}

                    {/* RIGHT SIDEBAR (Ultra-narrow 1/6 column, strictly right grid) */}
                    <div className="w-[16.6%] flex flex-col pointer-events-auto gap-2 ml-auto h-full max-h-[85vh] overflow-visible z-30 pt-4 px-1">

                        {activePose && (
                            <div className="flex flex-col gap-1.5 shrink-0">
                                <div className="bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-1.5">
                                    <span className="text-mcai-accent font-black text-[7px] uppercase block mb-0.5">HEAD</span>
                                    <p className="text-white/90 text-[8px] leading-[1.1] font-medium">{activePose.structure?.head || "Natural"}</p>
                                </div>
                                <div className="bg-black/60 backdrop-blur-md rounded-lg border border-white/10 p-1.5">
                                    <span className="text-mcai-accent font-black text-[7px] uppercase block mb-0.5">HANDS</span>
                                    <p className="text-white/90 text-[8px] leading-[1.1] font-medium">{activePose.structure?.hands || "Relaxed"}</p>
                                </div>
                                <div className={`backdrop-blur-md rounded-lg border p-1.5 transition-all ${feetWarning ? 'bg-red-500/40 border-red-500/60 shadow-lg' : 'bg-black/60 border-white/10'}`}>
                                    <span className={`font-black text-[7px] uppercase block mb-0.5 ${feetWarning ? 'text-white' : 'text-mcai-accent'}`}>FEET</span>
                                    <p className={`text-[8px] leading-[1.1] font-medium ${feetWarning ? 'text-white' : 'text-white/90'}`}>{feetWarning ? "Fix!" : (activePose.structure?.feet || "Stable")}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- BOTTOM AREA --- */}
                <div className="bg-gradient-to-t from-black via-black/80 to-transparent pb-10 pt-16 pointer-events-auto relative flex flex-col justify-end">
                    <div className="flex justify-center items-center gap-4 mb-8 z-40">
                        {[0.5, 1, 2, 3, 5].map((z) => (
                            <button key={z} onClick={() => setZoomLevel(z)} className={`text-[10px] font-bold w-8 h-8 rounded-full flex items-center justify-center transition-all border ${zoomLevel === z ? 'bg-mcai-accent text-black border-mcai-accent scale-110 shadow-lg' : 'bg-black/40 text-white/70 border-white/10'}`}>{z}x</button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between px-8 relative z-40 h-24">
                        <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-white/20 overflow-hidden shadow-lg">{lastPhoto && <img src={lastPhoto} className="w-full h-full object-cover" alt="" />}</div>
                        <div className="relative">
                            <button onClick={handleShutter} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform bg-white/10 backdrop-blur-sm"><div className="w-16 h-16 rounded-full bg-white" /></button>
                        </div>
                        <div className="flex flex-col gap-4 items-end w-14">
                            <button onClick={handleFinish} className="w-12 h-12 rounded-full bg-mcai-accent text-black flex items-center justify-center font-bold shadow-lg active:scale-90 transition-transform"><CheckCircle2 size={24} /></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};