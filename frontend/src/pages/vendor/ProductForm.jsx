import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, getProduct, getCategories } from '../../api/products';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '',
    category_id: '', condition: 'new', status: 'active', location: '',
  });

  useEffect(() => {
    getCategories().then((res) => setCategories(res.data.data.categories));

    if (isEdit) {
      getProduct(id).then((res) => {
        const p = res.data.data.product;
        setForm({
          name: p.name, description: p.description || '', price: p.price,
          stock: p.stock, category_id: p.category_id || '',
          condition: p.condition, status: p.status, location: p.location || '',
        });
      });
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => formData.append(key, val));
      images.forEach((img) => formData.append('images', img));

      if (isEdit) {
        await updateProduct(id, formData);
        toast.success('Produit mis à jour');
      } else {
        await createProduct(formData);
        toast.success('Produit créé');
      }
      navigate('/vendeur/produits');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-4">
        {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
      </h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
        <Input
          label="Nom du produit"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#1A1A18]">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1B6B3A] focus:ring-2 focus:ring-[#D6EAE0]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prix (FCFA)"
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <Input
            label="Stock"
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#1A1A18]">Catégorie</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1B6B3A]"
          >
            <option value="">Sélectionner...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#1A1A18]">État</label>
          <select
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1B6B3A]"
          >
            <option value="new">Neuf</option>
            <option value="used">Occasion</option>
            <option value="refurbished">Reconditionné</option>
          </select>
        </div>

        <Input
          label="Localisation"
          placeholder="Cotonou, Akpakpa"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[#1A1A18]">Photos</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setImages(Array.from(e.target.files))}
            className="text-sm"
          />
        </div>

        <Button type="submit" size="full" loading={loading}>
          {isEdit ? 'Mettre à jour' : 'Publier le produit'}
        </Button>
      </form>
    </div>
  );
};

export default ProductForm;