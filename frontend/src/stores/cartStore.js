import { create } from 'zustand';

const stored = localStorage.getItem('cart');
const initialItems = stored ? JSON.parse(stored) : [];

const useCartStore = create((set, get) => ({
  items: initialItems,

  addItem: (product, quantity = 1) => {
    const items = get().items;
    const existing = items.find((i) => i.product_id === product.id);

    let newItems;
    if (existing) {
      newItems = items.map((i) =>
        i.product_id === product.id
          ? { ...i, quantity: i.quantity + quantity }
          : i
      );
    } else {
      newItems = [
        ...items,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          thumbnail: product.thumbnail,
          vendor_id: product.vendor_id,
          quantity,
        },
      ];
    }

    localStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },

  removeItem: (product_id) => {
    const newItems = get().items.filter((i) => i.product_id !== product_id);
    localStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },

  updateQuantity: (product_id, quantity) => {
    if (quantity < 1) return;
    const newItems = get().items.map((i) =>
      i.product_id === product_id ? { ...i, quantity } : i
    );
    localStorage.setItem('cart', JSON.stringify(newItems));
    set({ items: newItems });
  },

  clearCart: () => {
    localStorage.removeItem('cart');
    set({ items: [] });
  },

  get total() {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  },

  get count() {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));

export default useCartStore;