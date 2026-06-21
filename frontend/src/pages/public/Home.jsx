import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getCategories } from '../../api/products';
import ProductGrid from '../../components/product/ProductGrid';
import Button from '../../components/ui/Button';
import { Search } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          getProducts({ limit: 8, sort: 'views', order: 'DESC' }),
          getCategories(),
        ]);
        setProducts(productsRes.data.data.products);
        setCategories(categoriesRes.data.data.categories);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {/* Hero */}
      <div
        className="px-4 py-12 text-center"
        style={{ background: 'linear-gradient(135deg, #1B6B3A, #145229)' }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
          Le marché du Bénin,<br />en ligne
        </h1>
        <p className="text-white/80 text-sm mb-6">
          Achète et vends en toute confiance à Cotonou et partout au Bénin
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="accent" onClick={() => navigate('/produits')}>
            <Search size={16} className="mr-1.5" />
            Explorer
          </Button>
          <Button
            variant="outline"
            className="!border-white/50 !text-white hover:!bg-white/10"
            onClick={() => navigate('/inscription')}
          >
            Vendre
          </Button>
        </div>
      </div>

      {/* Catégories */}
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <h2 className="text-sm font-semibold text-[#1A1A18] mb-3">Catégories</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/categorie/${cat.slug}`)}
              className="flex flex-col items-center gap-1.5 min-w-[72px] active:scale-95 transition"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-2xl shadow-sm">
                {cat.icon}
              </div>
              <span className="text-xs text-gray-600 text-center leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Produits populaires */}
      <div className="px-4 py-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#1A1A18]">Produits populaires</h2>
          <button onClick={() => navigate('/produits')} className="text-xs text-[#1B6B3A] font-medium">
            Voir tout →
          </button>
        </div>
        <ProductGrid products={products} loading={loading} />
      </div>
    </div>
  );
};

export default Home;