import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../../api/products';
import { getOrCreateConversation } from '../../api/messages';
import { formatPrice } from '../../utils/formatPrice';
import useCartStore from '../../stores/cartStore';
import useAuthStore from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge } from '../../components/ui/Badge';
import Loader from '../../components/shared/Loader';
import { MapPin, Star, MessageCircle, ShoppingCart, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const { isAuth, user } = useAuthStore();

  useEffect(() => {
    getProduct(id)
      .then((res) => setProduct(res.data.data.product))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    addItem(product);
    toast.success('Ajouté au panier !');
  };

  const handleContact = async () => {
    if (!isAuth) {
      navigate('/connexion');
      return;
    }
    try {
      const res = await getOrCreateConversation({ vendor_id: product.vendor_id, product_id: product.id });
      navigate(`/messages?conv=${res.data.data.conversation_id}`);
    } catch (err) {
      toast.error('Erreur lors de la création de la conversation');
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    const text = `${product.name} - ${formatPrice(product.price)}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <Loader text="Chargement du produit..." />;
  if (!product) return <p className="text-center py-16 text-gray-500">Produit introuvable</p>;

  const isPromo = product.promo_price && new Date(product.promo_ends_at) > new Date();
  const displayPrice = isPromo ? product.promo_price : product.price;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Image */}
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 h-72 md:h-96 flex items-center justify-center">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🛍️</span>
          )}
        </div>

        {/* Infos */}
        <div>
          {isPromo && (
            <Badge variant="promo" className="mb-2">
              Promo -{Math.round((1 - product.promo_price / product.price) * 100)}%
            </Badge>
          )}

          <h1 className="text-xl font-bold text-[#1A1A18] mb-2">{product.name}</h1>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-bold text-[#F4A100]">{formatPrice(displayPrice)}</span>
            {isPromo && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.price)}</span>
            )}
          </div>

          {/* Vendeur */}
          <div
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 mb-4 cursor-pointer hover:border-[#1B6B3A] transition"
            onClick={() => navigate(`/boutique/${product.vendor_id}`)}
          >
            <div className="w-10 h-10 rounded-full bg-[#D6EAE0] flex items-center justify-center text-[#1B6B3A] font-bold">
              {product.shop_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1A1A18]">{product.shop_name}</p>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={10} />
                <span>{product.city || 'Bénin'}</span>
                {product.badge_verified === 1 && <Badge variant="verified" className="ml-1">✓ Vérifié</Badge>}
              </div>
            </div>
            {product.reputation_score > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <Star size={14} className="text-[#F4A100] fill-[#F4A100]" />
                <span className="font-medium">{product.reputation_score.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">{product.description}</p>

          {/* Stock */}
          <p className="text-xs text-gray-400 mb-4">
            {product.stock > 0 ? `${product.stock} en stock` : 'Stock épuisé'}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleAddToCart} disabled={product.stock === 0} className="flex-1">
              <ShoppingCart size={16} className="mr-1.5" />
              Ajouter au panier
            </Button>
            <Button variant="outline" onClick={handleContact}>
              <MessageCircle size={16} />
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;