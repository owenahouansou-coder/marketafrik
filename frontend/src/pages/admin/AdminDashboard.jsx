import { useEffect, useState } from 'react';
import { getDashboard } from '../../api/admin';
import { formatPrice } from '../../utils/formatPrice';
import Loader from '../../components/shared/Loader';

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Chargement du dashboard admin..." />;
  if (!data) return null;

  const { users, orders, revenue, products, disputes, kyc_pending } = data;

  const metrics = [
    { label: 'Utilisateurs', value: users.total, sub: `${users.new_this_month} ce mois` },
    { label: 'Commandes', value: orders.total, sub: `${orders.pending} en attente` },
    { label: 'GMV total', value: formatPrice(revenue.gmv || 0), sub: '' },
    { label: 'Commissions', value: formatPrice(revenue.commissions || 0), sub: 'encaissées' },
    { label: 'Produits en attente', value: products.pending || 0, sub: 'à valider' },
    { label: 'Litiges ouverts', value: disputes.open || 0, sub: `${disputes.awaiting_review || 0} en révision` },
    { label: 'KYC en attente', value: kyc_pending, sub: 'vendeurs' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-lg font-bold text-[#1A1A18] mb-6">Dashboard Admin</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{m.label}</p>
            <p className="text-xl font-bold text-[#1A1A18]">{m.value}</p>
            {m.sub && <p className="text-xs text-gray-400 mt-1">{m.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;