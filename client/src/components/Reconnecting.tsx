// ============================================================
// Held while a refreshed tab asks the server for its seat back
// ============================================================

import { Screen, Spinner } from '../ui';

export default function Reconnecting() {
  return (
    <Screen>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <Spinner size={34} />
        <p className="text-[17px] font-bold">Rejoining your table</p>
        <p className="text-[14px] text-white/50">Holding your seat while the connection comes back.</p>
      </div>
    </Screen>
  );
}
