import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../../api/orders';
import { formatPrice, formatDate } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/Badge';
import Loader from '../../components/shared/Loader';
import EmptyState from '../../components/shared/EmptyState';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      .then((res) => setOrders(res.data.data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Chargement des commandes..." />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="Aucune commande"
        description="Vos commandes apparaîtront ici"
        action="Voir le catalogue"
        onAction={() => navigate('/produits')}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-4">Mes commandes</h1>

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-[#1B6B3A] transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#1A1A18]">Commande #{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{order.vendor_shop}</span>
              <span className="font-bold text-[#F4A100]">{formatPrice(order.total_amount)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{formatDate(order.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;