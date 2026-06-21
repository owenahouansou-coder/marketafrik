import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../../api/vendors';
import { getWallet } from '../../api/orders';
import { formatPrice } from '../../utils/formatPrice';
import { StatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loader from '../../components/shared/Loader';
import { Package, Eye, Wallet, Star } from 'lucide-react';

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getWallet()])
      .then(([dashRes, walletRes]) => {
        setData(dashRes.data.data);
        setWallet(walletRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Chargement du dashboard..." />;
  if (!data) return null;

  const { profile, stats, recent_products } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-[#1A1A18]">{profile.shop_name}</h1>
          <p className="text-sm text-gray-500">
            {profile.kyc_status === 'approved' ? '✓ Compte vérifié' : 'KYC en attente'}
          </p>
        </div>
        <Button onClick={() => navigate('/vendeur/produits/nouveau')}>
          + Nouveau produit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Package size={14} />
            <span className="text-xs">Produits actifs</span>
          </div>
          <p className="text-xl font-bold text-[#1A1A18]">{stats.active_products || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Eye size={14} />
            <span className="text-xs">Vues totales</span>
          </div>
          <p className="text-xl font-bold text-[#1A1A18]">{stats.total_views || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Wallet size={14} />
            <span className="text-xs">Solde wallet</span>
          </div>
          <p className="text-xl font-bold text-[#F4A100]">{formatPrice(wallet?.wallet_balance || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Star size={14} />
            <span className="text-xs">Réputation</span>
          </div>
          <p className="text-xl font-bold text-[#1A1A18]">{profile.reputation_score?.toFixed(1) || '—'}</p>
        </div>
      </div>

      {/* Produits récents */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold">Produits récents</p>
          <button onClick={() => navigate('/vendeur/produits')} className="text-xs text-[#1B6B3A] font-medium">
            Voir tout →
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recent_products?.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{p.name}</p>
                <p className="text-xs text-gray-400">{p.views} vues · Stock: {p.stock}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#F4A100]">{formatPrice(p.price)}</span>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;