// ============================================================
// Bottom sheet — the standard modal surface on phones
// ============================================================

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Sheet({
  open,
  onClose,
  title,
  children,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissable?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dismissable && onClose()}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(2,12,9,.72)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-[28px] overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(180deg,#132a22 0%,#0b1a15 100%)',
              borderTop: '1px solid rgba(255,255,255,.14)',
              maxHeight: '88dvh',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div className="shrink-0 pt-3 pb-1 flex justify-center">
              <div className="w-11 h-1.5 rounded-full bg-white/25" />
            </div>
            {title && (
              <h2 className="shrink-0 text-[20px] font-extrabold text-center px-6 pt-1 pb-3">
                {title}
              </h2>
            )}
            <div className="screen-scroll no-bar px-6 pb-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
