import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';

import Home from './screens/Home';
import CreateRoom from './screens/CreateRoom';
import JoinRoom from './screens/JoinRoom';
import Lobby from './screens/Lobby';
import Game from './screens/Game';
import Score from './screens/Score';
import Settings from './screens/Settings';
import Rules from './screens/Rules';
import Banners from './components/Banners';

import { bindSocket } from './lib/socket';
import { useGameStore } from './store/gameStore';
import { applyTheme, useSettings } from './store/settingsStore';
import { syncMusic } from './lib/audio';

// Dev builds expose the store so the browser console and the screenshot
// harness can inspect or seed state. Stripped from a production build.
if (import.meta.env.DEV) {
  (window as unknown as { kadi: unknown }).kadi = useGameStore;
}

function App() {
  const theme = useSettings((s) => s.theme);
  const music = useSettings((s) => s.music);

  useEffect(() => { bindSocket(); }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { syncMusic(); }, [music]);

  return (
    <BrowserRouter>
      <Banners />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:code" element={<JoinRoom />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game" element={<Game />} />
        <Route path="/score" element={<Score />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
