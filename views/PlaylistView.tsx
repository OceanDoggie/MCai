import React, { useRef, useState } from 'react';
import { MoreHorizontal, PlayCircle, ArrowDownToLine, X, Plus, GripHorizontal, Upload, Loader2, Sparkles, Trash2, Edit3, PlusCircle, CheckCircle2, Circle, FolderInput, ChevronRight, Check } from 'lucide-react';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { useUIStore } from '../store/useUIStore';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { PlaylistItem, PoseCategory, PoseDifficulty } from '../types';
import { detectPoseFromImage } from '../utils/mediaPipeService';
import { generateStaticGuidance } from '../utils/poseGuidance';

export const PlaylistView: React.FC = () => {
    const {
        unsortedPoses,
        savedPlaylists,
        moveFromUnsortedToPlaylist,
        moveBatchToPlaylist,
        removeFromUnsorted,
        removeFromSavedPlaylist,
        updatePlaylistItems,
        addToUnsorted,
        setActiveSession,
        createNewPlaylist,
        deleteSavedPlaylist
    } = usePlaylistStore();
    const { setView, showToast } = useUIStore();

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);

    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isMoveSheetOpen, setIsMoveSheetOpen] = useState(false);
    const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleStartSession = (playlistId: string) => {
        const targetPlaylist = savedPlaylists.find(pl => pl.id === playlistId);
        if (!targetPlaylist || targetPlaylist.items.length === 0) {
            showToast("Add poses to this booklet first!");
            return;
        }
        setActiveSession(targetPlaylist.items);
        setView('camera');
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        showToast("Analyzing your photo...");

        const reader = new FileReader();
        reader.onloadend = async () => {
            let base64String = reader.result as string;

            try {
                // --- 1. Compress Image ---
                const img = new Image();
                img.src = base64String;
                await new Promise((resolve) => { img.onload = resolve; });

                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                base64String = canvas.toDataURL('image/jpeg', 0.7);

                // --- 2. Parallel: MediaPipe local + backend AI analysis ---
                const mediapipePromise = detectPoseFromImage(img);
                const analyzePromise = fetch('http://localhost:8000/api/analyze-pose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64String, source_name: file.name })
                }).then(res => {
                    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
                    return res.json();
                });

                const [poseResult, geminiAnalysis] = await Promise.all([
                    mediapipePromise.catch(err => {
                        console.warn("MediaPipe detection failed:", err);
                        return { landmarks: [[]] };
                    }),
                    analyzePromise.catch(err => {
                        console.warn("Backend analysis failed, using fallback:", err);
                        return {
                            title: "New Pose",
                            description: "AI analysis unavailable",
                            tags: ["Custom"],
                            difficulty: "Medium",
                            tips: ["Replicate the photo"],
                            structure: { head: "Natural", hands: "Relaxed", feet: "Stable" }
                        };
                    })
                ]);

                const landmarks = poseResult.landmarks?.[0] || [];

                const newPose = {
                    id: geminiAnalysis.pose_id ? `custom-${geminiAnalysis.pose_id}` : `custom-${Date.now()}`,
                    title: geminiAnalysis.title,
                    description: geminiAnalysis.description,
                    imageSrc: base64String,
                    category: PoseCategory.SELFIE,
                    tags: geminiAnalysis.tags,
                    difficulty: (geminiAnalysis.difficulty as any) || PoseDifficulty.MEDIUM,
                    tips: geminiAnalysis.tips,
                    structure: geminiAnalysis.structure,
                    landmarks: landmarks
                };

                addToUnsorted(newPose);
                showToast("Analysis complete!");
            } catch (error: any) {
                console.error("Analysis Error:", error);
                showToast("Analysis failed. Using offline mode.");

                addToUnsorted({
                    id: `custom-${Date.now()}`,
                    title: "New Pose",
                    description: "Offline mode",
                    imageSrc: base64String,
                    category: PoseCategory.SELFIE,
                    tags: ["Custom", "Offline"],
                    difficulty: PoseDifficulty.MEDIUM,
                    tips: ["Replicate the photo"],
                    structure: { head: "Natural", hands: "Relaxed", feet: "Stable" }
                });
            } finally {
                setIsAnalyzing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const activePlaylistForPicker = savedPlaylists.find(p => p.id === addingToPlaylistId);

    return (
        <div className="min-h-screen bg-black text-white pb-32 animate-in slide-in-from-right duration-300 flex flex-col relative" onClick={() => {
            if (isMenuOpen) setIsMenuOpen(false);
            if (isMoveSheetOpen) setIsMoveSheetOpen(false);
        }}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* --- HEADER --- */}
            <div className="px-6 py-6 flex justify-between items-center bg-black sticky top-0 z-30 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-bold font-serif italic tracking-wide">My Booklets</h1>
                    {isDeleteMode && <span className="text-xs text-red-500 font-medium animate-pulse">Edit Mode</span>}
                </div>
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className={`p-2 rounded-full transition-all ${isMenuOpen || isDeleteMode ? 'bg-mcai-accent text-black' : 'bg-white/10 hover:bg-white/20'}`}><MoreHorizontal size={24} /></button>
                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="absolute right-0 top-12 w-48 bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                                <button onClick={() => { createNewPlaylist(); setIsMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 text-left border-b border-white/5"><PlusCircle size={16} />Add Booklet</button>
                                <button onClick={() => { setIsDeleteMode(!isDeleteMode); setIsMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-white/5 ${isDeleteMode ? 'text-mcai-accent font-bold' : 'text-white'}`}>{isDeleteMode ? <><X size={16} /> Done</> : <><Edit3 size={16} /> Manage Booklets</>}</button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pt-6">
                <div className="space-y-8">
                    {savedPlaylists.length === 0 ? <div className="text-center py-10 opacity-40"><p>No booklets yet.</p></div> : savedPlaylists.map((pl) => (
                        <PlaylistRow key={pl.id} playlist={pl} isDeleteMode={isDeleteMode} onDelete={() => { if (confirm("Delete?")) deleteSavedPlaylist(pl.id); }} onUpdate={(items) => updatePlaylistItems(pl.id, items)} onStart={() => handleStartSession(pl.id)} onRemoveItem={(itemId) => removeFromSavedPlaylist(pl.id, itemId)} onOpenPicker={() => setAddingToPlaylistId(pl.id)} />
                    ))}
                </div>

                <div className="px-6 pb-20">
                    <div className="flex items-center justify-between gap-3 mb-6 relative">
                        <div className="h-px bg-white/10 flex-1" />
                        <div className="text-center"><h3 className="text-xs font-bold text-mcai-subtext uppercase tracking-widest">Unsorted Poses</h3></div>
                        <div className="h-px bg-white/10 flex-1" />
                        {unsortedPoses.length > 0 && <button onClick={() => { if (isBatchMode) setSelectedItems(new Set()); setIsBatchMode(!isBatchMode); }} className={`absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-1 rounded ${isBatchMode ? 'text-black bg-mcai-accent' : 'text-mcai-accent'}`}>{isBatchMode ? 'Done' : 'Select'}</button>}
                    </div>

                    <div className="grid grid-cols-4 gap-3 relative min-h-[100px]">
                        {!isBatchMode && (
                            <button onClick={handleUploadClick} disabled={isAnalyzing} className="aspect-square rounded-lg bg-zinc-900 border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 group relative overflow-hidden">
                                {isAnalyzing ? <><Loader2 className="animate-spin text-mcai-accent" size={20} /><span className="text-[8px] text-mcai-accent animate-pulse">Thinking...</span></> : <><div className="p-1.5 rounded-full bg-white/5"><Upload size={16} /></div><span className="text-[8px] font-medium text-white/40">AI Upload</span></>}
                            </button>
                        )}
                        {unsortedPoses.map((item) => (
                            <DraggableUnsortedItem key={item.instanceId} item={item} playlists={savedPlaylists} isBatchMode={isBatchMode} isSelected={selectedItems.has(item.instanceId)} onToggleSelect={() => toggleSelection(item.instanceId)} onDropToPlaylist={(plId) => { moveFromUnsortedToPlaylist(plId, item.instanceId); showToast("Moved to booklet"); }} onRemove={() => removeFromUnsorted(item.instanceId)} />
                        ))}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isBatchMode && selectedItems.size > 0 && (
                    <motion.div initial={{ y: 100, opacity: 0, x: "-50%" }} animate={{ y: 0, opacity: 1, x: "-50%" }} exit={{ y: 100, opacity: 0, x: "-50%" }} className="fixed bottom-[100px] left-1/2 bg-[#1C1C1E] border border-white/10 px-6 py-3 rounded-full flex gap-6 shadow-2xl z-40 items-center">
                        <span className="text-xs font-bold text-white">{selectedItems.size} selected</span>
                        <button onClick={() => { if (confirm("Remove?")) { selectedItems.forEach(id => removeFromUnsorted(id)); setSelectedItems(new Set()); showToast("Removed"); } }} className="text-white/60 hover:text-red-500"><Trash2 size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setIsMoveSheetOpen(true); }} className="text-mcai-accent"><FolderInput size={18} /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <PosePickerSheet isOpen={!!addingToPlaylistId} playlistTitle={activePlaylistForPicker?.title} onClose={() => setAddingToPlaylistId(null)} unsortedPoses={unsortedPoses} onConfirm={(ids) => { if (addingToPlaylistId) { moveBatchToPlaylist(addingToPlaylistId, ids); showToast("Added!"); setAddingToPlaylistId(null); } }} />
        </div>
    );
};

const PlaylistRow: React.FC<{
    playlist: { id: string; title: string; items: PlaylistItem[] };
    onUpdate: (items: PlaylistItem[]) => void;
    onStart: () => void;
    onRemoveItem: (id: string) => void;
    onOpenPicker: () => void;
    isDeleteMode: boolean;
    onDelete: () => void;
}> = ({ playlist, onUpdate, onStart, onRemoveItem, onOpenPicker, isDeleteMode, onDelete }) => {
    return (
        <div className="flex flex-col relative group/row transition-all">
            <div className="px-6 flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    {isDeleteMode ? <button onClick={onDelete} className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"><Trash2 size={12} /></button> : <div className="w-1 h-4 bg-mcai-accent rounded-full" />}
                    <h2 className="text-lg font-bold text-white tracking-tight">{playlist.title}</h2>
                    <span className="text-[10px] font-mono text-mcai-subtext bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{playlist.items.length}</span>
                </div>
                {!isDeleteMode && <button onClick={onStart} className="flex items-center gap-1.5 text-mcai-accent text-xs font-bold uppercase tracking-wider bg-mcai-accent/10 px-3 py-1.5 rounded-lg"><span>Start</span></button>}
            </div>
            <div id={`playlist-dropzone-${playlist.id}`} className="w-full overflow-x-auto no-scrollbar px-6 min-h-[120px] flex items-center relative">
                <div className={`absolute inset-x-6 inset-y-0 border-2 border-dashed rounded-xl pointer-events-none -z-10 bg-white/[0.02] ${isDeleteMode ? 'border-red-500/20' : 'border-white/5'}`} />
                <div className="flex gap-3">
                    <Reorder.Group axis="x" values={playlist.items} onReorder={onUpdate} className="flex gap-3">
                        {playlist.items.map((item, idx) => (
                            <Reorder.Item key={item.instanceId} value={item} className="relative group touch-none" whileDrag={{ scale: 1.1, zIndex: 50 }}>
                                <div className="w-24 aspect-[3/4] rounded-lg overflow-hidden bg-zinc-900 border border-white/10 relative">
                                    <img src={item.imageSrc} className="w-full h-full object-cover opacity-80" alt="" draggable={false} />
                                    <div className="absolute top-1 left-1 w-4 h-4 bg-black/60 rounded flex items-center justify-center text-[9px] font-bold z-10">{idx + 1}</div>
                                    {!isDeleteMode && <button onClick={(e) => { e.stopPropagation(); onRemoveItem(item.instanceId); }} className="absolute bottom-1 right-1 p-1 bg-red-500/80 rounded text-white opacity-0 group-hover:opacity-100"><X size={10} /></button>}
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                    {!isDeleteMode && <button onClick={onOpenPicker} className="w-24 aspect-[3/4] rounded-lg border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-2 flex-shrink-0">
                        <Plus size={18} /><span className="text-[9px] font-bold uppercase">Add</span>
                    </button>}
                </div>
            </div>
        </div>
    );
};

const DraggableUnsortedItem: React.FC<{
    item: PlaylistItem;
    playlists: { id: string }[];
    onDropToPlaylist: (playlistId: string) => void;
    onRemove: () => void;
    isBatchMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}> = ({ item, playlists, onDropToPlaylist, onRemove, isBatchMode, isSelected, onToggleSelect }) => {
    const handleDragEnd = (event: any, info: any) => {
        if (isBatchMode) return;
        const { x, y } = info.point;
        for (const pl of playlists) {
            const el = document.getElementById(`playlist-dropzone-${pl.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    onDropToPlaylist(pl.id);
                    return;
                }
            }
        }
    };

    return (
        <motion.div drag={!isBatchMode} dragSnapToOrigin dragElastic={0.2} dragMomentum={false} whileDrag={{ scale: 1.1, zIndex: 100 }} onDragEnd={handleDragEnd} onClick={isBatchMode ? onToggleSelect : undefined} layout exit={{ scale: 0, opacity: 0 }} className={`relative aspect-square rounded-lg overflow-hidden touch-none ${isSelected ? 'ring-2 ring-mcai-accent' : ''}`}>
            <div className="w-full h-full bg-zinc-800 relative group">
                <img src={item.imageSrc} className={`w-full h-full object-cover ${isBatchMode ? 'opacity-60' : 'opacity-80'}`} alt="" draggable={false} />
                {isBatchMode && <div className="absolute top-1 right-1 z-30">{isSelected ? <CheckCircle2 size={16} className="text-mcai-accent fill-black" /> : <Circle size={16} className="text-white/50" />}</div>}
                {!isBatchMode && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} onPointerDown={(e) => e.stopPropagation()} className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center z-20"><X size={10} /></button>}
            </div>
        </motion.div>
    );
};

const PosePickerSheet: React.FC<{
    isOpen: boolean;
    playlistTitle?: string;
    onClose: () => void;
    unsortedPoses: PlaylistItem[];
    onConfirm: (selectedIds: string[]) => void;
}> = ({ isOpen, playlistTitle, onClose, unsortedPoses, onConfirm }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    React.useEffect(() => { if (isOpen) setSelectedIds(new Set()); }, [isOpen]);
    const toggleSelect = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    return (
        <AnimatePresence>
            {isOpen && (
                <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-[60]" onClick={onClose} />
                    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 bg-[#1C1C1E] rounded-t-2xl z-[70] flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1C1C1E] z-10"><div><h3 className="text-sm font-bold text-white">Add to {playlistTitle}</h3></div><button onClick={onClose}><X size={16} /></button></div>
                        <div className="p-4 overflow-y-auto min-h-[200px] grid grid-cols-4 gap-2">
                            {unsortedPoses.map((p) => (
                                <div key={p.instanceId} onClick={() => toggleSelect(p.instanceId)} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${selectedIds.has(p.instanceId) ? 'border-mcai-accent' : 'border-transparent'}`}><img src={p.imageSrc} className="w-full h-full object-cover" alt="" /></div>
                            ))}
                        </div>
                        <div className="p-4 pb-8"><button disabled={selectedIds.size === 0} onClick={() => onConfirm(Array.from(selectedIds))} className="w-full py-3 bg-mcai-accent text-black font-bold rounded-xl disabled:opacity-50">Confirm {selectedIds.size} Poses</button></div>
                    </motion.div></>
            )}
        </AnimatePresence>
    );
};