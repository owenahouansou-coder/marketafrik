import { create } from 'zustand';
import { getUnreadCount } from '../api/messages';

const useNotifStore = create((set) => ({
  unreadMessages: 0,

  refresh: async () => {
    try {
      const res = await getUnreadCount();
      set({ unreadMessages: res.data.data.unread_count });
    } catch (e) {}
  },
}));

export default useNotifStore;