import { ShoppingCart, MessageCircle, Menu, X, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useCartStore from '../../stores/cartStore';
import useNotifStore from '../../stores/notifStore';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuth, logout } = useAuthStore();
  const cartCount = useCartStore((s) => s.count);
  const unreadMessages = useNotifStore((s) => s.unreadMessages);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-[#1B6B3A] sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold">
          <span className="text-[#F4A100]">Market</span>
          <span className="text-white">Afrik</span>
        </Link>

        {/* Actions desktop */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/produits" className="text-white/80 hover:text-white text-sm transition">
            Catalogue
          </Link>
          <Link to="/vendeurs" className="text-white/80 hover:text-white text-sm transition">
            Vendeurs
          </Link>

          {isAuth ? (
            <>
              {/* Messages */}
              <button
                onClick={() => navigate('/messages')}
                className="relative text-white/80 hover:text-white transition"
              >
                <MessageCircle size={20} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F4A100] text-[#1A1A18] text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </button>

              {/* Panier */}
              <button
                onClick={() => navigate('/panier')}
                className="relative text-white/80 hover:text-white transition"
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F4A100] text-[#1A1A18] text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Dashboard selon rôle */}
              <button
                onClick={() => navigate(user?.role === 'vendor' ? '/vendeur' : user?.role === 'admin' ? '/admin' : '/mon-compte')}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                <User size={14} />
                {user?.name?.split(' ')[0]}
              </button>

              <button onClick={handleLogout} className="text-white/60 hover:text-white transition">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/connexion')}
                className="text-white/80 hover:text-white text-sm transition"
              >
                Connexion
              </button>
              <button
                onClick={() => navigate('/inscription')}
                className="bg-[#F4A100] text-[#1A1A18] text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-[#C07D00] transition"
              >
                S'inscrire
              </button>
            </div>
          )}
        </div>

        {/* Mobile — icônes + burger */}
        <div className="flex md:hidden items-center gap-3">
          {isAuth && (
            <>
              <button onClick={() => navigate('/messages')} className="relative text-white">
                <MessageCircle size={20} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F4A100] text-[#1A1A18] text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </button>
              <button onClick={() => navigate('/panier')} className="relative text-white">
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#F4A100] text-[#1A1A18] text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="md:hidden bg-[#145229] px-4 py-3 flex flex-col gap-3">
          <Link to="/produits" className="text-white/80 text-sm py-2 border-b border-white/10" onClick={() => setMenuOpen(false)}>
            Catalogue
          </Link>
          <Link to="/vendeurs" className="text-white/80 text-sm py-2 border-b border-white/10" onClick={() => setMenuOpen(false)}>
            Vendeurs
          </Link>
          {isAuth ? (
            <>
              <button
                onClick={() => { navigate(user?.role === 'vendor' ? '/vendeur' : '/mon-compte'); setMenuOpen(false); }}
                className="text-white/80 text-sm py-2 border-b border-white/10 text-left"
              >
                Mon compte
              </button>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="text-white/60 text-sm py-2 text-left">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { navigate('/connexion'); setMenuOpen(false); }} className="text-white/80 text-sm py-2 border-b border-white/10 text-left">
                Connexion
              </button>
              <button onClick={() => { navigate('/inscription'); setMenuOpen(false); }} className="text-[#F4A100] text-sm py-2 font-semibold text-left">
                S'inscrire
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;