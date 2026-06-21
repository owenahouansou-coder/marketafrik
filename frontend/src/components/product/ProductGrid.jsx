import ProductCard from './ProductCard';
import Loader from '../shared/Loader';
import EmptyState from '../shared/EmptyState';
import { useNavigate } from 'react-router-dom';

const ProductGrid = ({ products, loading }) => {
  const navigate = useNavigate();

  if (loading) return <Loader text="Chargement des produits..." />;

  if (!products || products.length === 0) {
    return (
      <EmptyState
        icon="🛍️"
        title="Aucun produit trouvé"
        description="Essaie de modifier tes filtres ou reviens plus tard."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => navigate(`/produits/${product.id}`)}
        />
      ))}
    </div>
  );
};

export default ProductGrid;