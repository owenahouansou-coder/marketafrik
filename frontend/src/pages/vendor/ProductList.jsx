import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct } from '../../api/products';
import useAuthStore from '../../stores/authStore';
import { formatPrice } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loader from '../../components/shared/Loader';
import EmptyState from '../../components/shared/EmptyState';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ProductList = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = () => {
    getProducts({ vendor_id: user.id, status: '', limit: 50 })
      .then((res) => setProducts(res.data.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      await deleteProduct(id);
      toast.success('Produit supprimé');
      fetchProducts();
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) return <Loader text="Chargement..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold text-[#1A1A18]">Mes produits ({products.length})</h1>
        <Button onClick={() => navigate('/vendeur/produits/nouveau')}>+ Nouveau</Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Aucun produit"
          description="Commencez à vendre en ajoutant votre premier produit"
          action="Ajouter un produit"
          onAction={() => navigate('/vendeur/produits/nouveau')}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-[#F7F3EE] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">🛍️</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1A1A18]">{p.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-[#F4A100]">{formatPrice(p.price)}</span>
                  <StatusBadge status={p.status} />
                  <span className="text-xs text-gray-400">Stock: {p.stock}</span>
                </div>
              </div>
              <button
                onClick={() => navigate(`/vendeur/produits/${p.id}/modifier`)}
                className="text-gray-400 hover:text-[#1B6B3A] transition p-2"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-gray-400 hover:text-[#C0390B] transition p-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductList;