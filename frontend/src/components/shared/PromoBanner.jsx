import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveCampaign } from '../../api/campaigns';
import { Megaphone } from 'lucide-react';

const PromoBanner = () => {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    getActiveCampaign()
      .then((res) => setCampaign(res.data.data.campaign))
      .catch(() => setCampaign(null));
  }, []);

  if (!campaign) return null;

  return (
    <div
      className="relative overflow-hidden mx-4 mt-4 rounded-2xl p-6 md:p-8 flex items-center justify-between gap-4"
      style={{
        background: `linear-gradient(135deg, ${campaign.bg_color}, ${campaign.bg_color}dd)`,
      }}
    >
      <div className="flex-1 z-10">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone size={16} className="text-white/90" />
          <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">
            Promo du jour
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
          {campaign.title}
        </h2>
        {campaign.subtitle && (
          <p className="text-sm text-white/80 mb-4">{campaign.subtitle}</p>
        )}
        <button
          onClick={() => navigate(campaign.cta_link)}
          className="bg-[#1B6B3A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#145229] transition flex items-center gap-1.5"
        >
          {campaign.cta_text} →
        </button>
      </div>

      {campaign.banner_image && (
        <div className="hidden md:block w-32 h-32 rounded-xl overflow-hidden flex-shrink-0">
          <img src={campaign.banner_image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
};

export default PromoBanner;