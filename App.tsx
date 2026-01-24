import React from 'react';
import { useUIStore } from './store/useUIStore';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';
import { HomeView } from './views/HomeView';
import { PlaylistView } from './views/PlaylistView';
import { CameraView } from './views/CameraView';
import { ResultView } from './views/ResultView';

const App: React.FC = () => {
  const { currentView } = useUIStore();

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-mcai-accent selection:text-black">
      
      <Toast />

      {/* 
        View Rendering Strategy:
        We use 'display: none' (via class 'hidden') instead of conditional rendering 
        to preserve internal state of each view.
      */}
      
      <div className={currentView === 'home' ? 'block' : 'hidden'}>
        <HomeView />
      </div>

      <div className={currentView === 'playlist' ? 'block' : 'hidden'}>
        <PlaylistView />
      </div>

      <div className={currentView === 'camera' ? 'block' : 'hidden'}>
        <CameraView />
      </div>

      {/* Result View takes over the screen */}
      {currentView === 'result' && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
           <ResultView />
        </div>
      )}

      {/* Bottom Navigation is hidden during Camera session and Result view */}
      {currentView !== 'result' && currentView !== 'camera' && <BottomNav />}
    </div>
  );
};

export default App;