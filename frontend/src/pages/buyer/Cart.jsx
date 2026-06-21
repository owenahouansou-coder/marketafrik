import { useNavigate } from 'react-router-dom';
import useCartStore from '../../stores/cartStore';
import { formatPrice } from '../../utils/formatPrice';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/shared/EmptyState';
import { Trash2, Plus, Minus } from 'lucide-react';

const Cart = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, total } = useCartStore();

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Votre panier est vide"
        description="Parcourez le catalogue pour trouver des produits"
        action="Voir le catalogue"
        onAction={() => navigate('/produits')}
      />
    );
  }

  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-4">Mon panier ({items.length})</h1>

      <div className="flex flex-col gap-3 mb-6">
        {items.map((item) => (
          <div key={item.product_id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-[#F7F3EE] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🛍️</span>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-[#1A1A18] mb-1">{item.name}</p>
              <p className="text-sm font-bold text-[#F4A100]">{formatPrice(item.price)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                className="w-7 h-7 rounded-full bg-[#F7F3EE] flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <Minus size={14} />
              </button>
              <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                className="w-7 h-7 rounded-full bg-[#F7F3EE] flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              onClick={() => removeItem(item.product_id)}
              className="text-gray-300 hover:text-[#C0390B] transition"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-500">Sous-total</span>
          <span className="text-sm font-medium">{formatPrice(cartTotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold text-[#F4A100]">{formatPrice(cartTotal)}</span>
        </div>
      </div>

      <Button size="full" onClick={() => navigate('/checkout')}>
        Passer la commande
      </Button>
    </div>
  );
};

export default Cart;