import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getVendor } from '../../api/vendors';
import ProductGrid from '../../components/product/ProductGrid';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/shared/Loader';
import { MapPin, Star, Calendar } from 'lucide-react';
import { formatDate } from '../../utils/formatPrice';

const VendorShop = () => {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVendor(id)
      .then((res) => setVendor(res.data.data.vendor))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader text="Chargement de la boutique..." />;
  if (!vendor) return <p className="text-center py-16 text-gray-500">Boutique introuvable</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header boutique */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#D6EAE0] flex items-center justify-center text-[#1B6B3A] font-bold text-2xl">
          {vendor.shop_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-[#1A1A18]">{vendor.shop_name}</h1>
            {vendor.badge_verified === 1 && <Badge variant="verified">✓ Vérifié</Badge>}
          </div>
          <p className="text-sm text-gray-500 mb-1">{vendor.description}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {vendor.city || 'Bénin'}{vendor.district ? `, ${vendor.district}` : ''}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              Depuis {formatDate(vendor.created_at)}
            </span>
            {vendor.reputation_score > 0 && (
              <span className="flex items-center gap-1">
                <Star size={12} className="text-[#F4A100] fill-[#F4A100]" />
                {vendor.reputation_score.toFixed(1)} ({vendor.total_sales} ventes)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Produits */}
      <h2 className="text-sm font-semibold text-[#1A1A18] mb-3">
        Produits ({vendor.products?.length || 0})
      </h2>
      <ProductGrid products={vendor.products} loading={false} />
    </div>
  );
};

export default VendorShop;