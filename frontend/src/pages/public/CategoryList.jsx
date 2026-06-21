import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getProducts, getCategories } from '../../api/products';
import { getZones } from '../../api/vendors';
import ProductGrid from '../../components/product/ProductGrid';

const CategoryList = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [zones, setZones] = useState({});
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: searchParams.get('q') || '',
    city: searchParams.get('ville') || '',
    sort: 'created_at',
  });

  useEffect(() => {
    getCategories().then((res) => setCategories(res.data.data.categories));
    getZones().then((res) => setZones(res.data.data.zones));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {
      limit: 24,
      sort: filters.sort,
      order: 'DESC',
      ...(slug && { category: slug }),
      ...(filters.search && { search: filters.search }),
      ...(filters.city && { city: filters.city }),
    };

    getProducts(params)
      .then((res) => setProducts(res.data.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug, filters]);

  const currentCategory = categories.find((c) => c.slug === slug);
  const pageTitle = currentCategory ? currentCategory.icon + ' ' + currentCategory.name : 'Tous les produits';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-4">{pageTitle}</h1>

      <div className="flex flex-wrap gap-2 mb-5">
        <input
          type="text"
          placeholder="Rechercher..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1 min-w-[140px] outline-none focus:border-[#1B6B3A]"
        />

        <select
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1B6B3A]"
        >
          <option value="">Toutes les villes</option>
          {Object.keys(zones).map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1B6B3A]"
        >
          <option value="created_at">Plus recents</option>
          <option value="price">Prix</option>
          <option value="views">Popularite</option>
        </select>
      </div>

      {!slug && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
          {categories.map(function(cat) {
            const linkUrl = '/categorie/' + cat.slug;
            return (
              <a key={cat.id} href={linkUrl} className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1.5 rounded-full text-xs whitespace-nowrap hover:border-[#1B6B3A] transition">
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </a>
            );
          })}
        </div>
      )}

      <ProductGrid products={products} loading={loading} />
    </div>
  );
};

export default CategoryList;