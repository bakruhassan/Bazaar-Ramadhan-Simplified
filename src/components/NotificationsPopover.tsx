import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X } from 'lucide-react';

interface Notification {
  id: number;
  message: string;
  is_read: number;
  created_at: string;
}

interface NotificationsPopoverProps {
  isOpen: boolean;
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: () => void;
}

export default function NotificationsPopover({ isOpen, notifications, onClose, onMarkRead }: NotificationsPopoverProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="absolute top-20 right-6 w-80 bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-100 dark:border-stone-800 overflow-hidden z-50"
        >
          <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800">
            <h3 className="text-lg font-serif font-bold">Updates</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={onMarkRead}
                className="p-2 text-stone-400 hover:text-green-500 transition-colors"
                title="Mark all as read"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-sm italic">
                No new notifications.
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${notif.is_read ? 'opacity-60' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}
                >
                  <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-stone-400 mt-2 block">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
