import { ShoppingCart, MapPin, Star } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';
import Badge from '../ui/Badge';
import useCartStore from '../../stores/cartStore';
import toast from 'react-hot-toast';

const ProductCard = ({ product, onClick }) => {
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addItem(product);
    toast.success('Ajouté au panier !');
  };

  const isPromo = product.promo_price && new Date(product.promo_ends_at) > new Date();
  const displayPrice = isPromo ? product.promo_price : product.price;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 active:scale-95"
    >
      {/* Image */}
      <div className="relative h-36 bg-[#F7F3EE] flex items-center justify-center overflow-hidden">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-4xl">🛍️</span>
        )}
        {isPromo && (
          <div className="absolute top-2 left-2">
            <Badge variant="promo">-{Math.round((1 - product.promo_price / product.price) * 100)}%</Badge>
          </div>
        )}
        {product.is_featured === 1 && (
          <div className="absolute top-2 right-2">
            <Badge variant="warning">⭐ Boost</Badge>
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="p-3">
        <p className="text-sm font-medium text-[#1A1A18] line-clamp-2 mb-1">{product.name}</p>

        {/* Prix */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-[#F4A100]">{formatPrice(displayPrice)}</span>
          {isPromo && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(product.price)}</span>
          )}
        </div>

        {/* Vendeur + zone */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin size={10} />
            <span>{product.city || 'Bénin'}</span>
          </div>
          {product.reputation_score > 0 && (
            <div className="flex items-center gap-0.5 text-xs text-gray-400">
              <Star size={10} className="text-[#F4A100] fill-[#F4A100]" />
              <span>{product.reputation_score?.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Bouton panier */}
        <button
          onClick={handleAddToCart}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#D6EAE0] text-[#1B6B3A] text-xs font-semibold hover:bg-[#1B6B3A] hover:text-white transition-all duration-200"
        >
          <ShoppingCart size={12} />
          Ajouter
        </button>
      </div>
    </div>
  );
};

export default ProductCard;