import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCartStore from '../../stores/cartStore';
import { createOrder, initiatePayment } from '../../api/orders';
import { formatPrice } from '../../utils/formatPrice';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

const Checkout = () => {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    delivery_option: 'standard',
    delivery_address: '',
    delivery_city: '',
    delivery_district: '',
    mobile_number: '',
    notes: '',
  });

  const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.delivery_city || !form.mobile_number) {
      toast.error('Ville et numéro Mobile Money requis');
      return;
    }

    setLoading(true);
    try {
      // 1. Créer la commande
      const orderRes = await createOrder({
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_option: form.delivery_option,
        delivery_address: form.delivery_address,
        delivery_city: form.delivery_city,
        delivery_district: form.delivery_district,
        notes: form.notes,
      });

      const order_id = orderRes.data.data.order_id;

      // 2. Initier le paiement
      await initiatePayment({
        order_id,
        mobile_number: form.mobile_number,
      });

      clearCart();
      toast.success('Commande passée ! Confirmez le paiement sur votre téléphone.');
      navigate('/mes-commandes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    navigate('/panier');
    return null;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-4">Finaliser la commande</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Récap */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-semibold mb-2">Récapitulatif</p>
          {items.map((item) => (
            <div key={item.product_id} className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{item.name} x{item.quantity}</span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-[#F4A100]">{formatPrice(cartTotal)}</span>
          </div>
        </div>

        {/* Livraison */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">Livraison</p>

          <div className="flex gap-2">
            {['standard', 'express', 'pickup'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setForm({ ...form, delivery_option: opt })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                  form.delivery_option === opt
                    ? 'bg-[#1B6B3A] text-white'
                    : 'bg-[#F7F3EE] text-gray-500'
                }`}
              >
                {opt === 'standard' ? 'Standard' : opt === 'express' ? 'Express' : 'Retrait'}
              </button>
            ))}
          </div>

          <Input
            label="Ville"
            placeholder="Cotonou"
            value={form.delivery_city}
            onChange={(e) => setForm({ ...form, delivery_city: e.target.value })}
          />
          <Input
            label="Quartier"
            placeholder="Akpakpa"
            value={form.delivery_district}
            onChange={(e) => setForm({ ...form, delivery_district: e.target.value })}
          />
          {form.delivery_option !== 'pickup' && (
            <Input
              label="Adresse précise"
              placeholder="Rue, repère..."
              value={form.delivery_address}
              onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
            />
          )}
        </div>

        {/* Paiement */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">Paiement Mobile Money</p>
          <Input
            label="Numéro MTN / Moov"
            placeholder="97 00 00 00"
            value={form.mobile_number}
            onChange={(e) => setForm({ ...form, mobile_number: e.target.value })}
          />
        </div>

        <Button type="submit" size="full" loading={loading}>
          Confirmer la commande
        </Button>
      </form>
    </div>
  );
};

export default Checkout;