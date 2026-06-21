const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-[#D6EAE0] text-[#0C3319]',
    warning: 'bg-[#FEF3D0] text-[#7A5000]',
    danger: 'bg-red-100 text-[#C0390B]',
    info: 'bg-blue-100 text-blue-800',
    promo: 'bg-[#FEF3D0] text-[#C07D00]',
    new: 'bg-[#D6EAE0] text-[#1B6B3A]',
    verified: 'bg-[#1B6B3A] text-white',
  };

  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'En attente', variant: 'warning' },
    confirmed: { label: 'Confirmée', variant: 'info' },
    shipped: { label: 'Expédiée', variant: 'info' },
    delivered: { label: 'Livrée', variant: 'success' },
    cancelled: { label: 'Annulée', variant: 'danger' },
    active: { label: 'Actif', variant: 'success' },
    draft: { label: 'Brouillon', variant: 'default' },
    paused: { label: 'En pause', variant: 'warning' },
    sold_out: { label: 'Épuisé', variant: 'danger' },
    approved: { label: 'Approuvé', variant: 'success' },
    rejected: { label: 'Rejeté', variant: 'danger' },
    submitted: { label: 'En cours', variant: 'warning' },
    open: { label: 'Ouvert', variant: 'danger' },
    resolved: { label: 'Résolu', variant: 'success' },
  };

  const config = map[status] || { label: status, variant: 'default' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default Badge;