import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#1A1A18] text-white/70 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Logo */}
        <div className="col-span-2 md:col-span-1">
          <p className="text-xl font-bold mb-2">
            <span className="text-[#F4A100]">Market</span>
            <span className="text-white">Afrik</span>
          </p>
          <p className="text-sm text-white/50">
            Le marché du Bénin en ligne. Achetez et vendez en toute confiance.
          </p>
          <p className="text-xs text-white/30 mt-3">Cotonou, Bénin 🇧🇯</p>
        </div>

        {/* Acheter */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Acheter</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/produits" className="hover:text-white transition">Catalogue</Link>
            <Link to="/categorie/electronique" className="hover:text-white transition">Électronique</Link>
            <Link to="/categorie/mode" className="hover:text-white transition">Mode</Link>
            <Link to="/categorie/alimentation" className="hover:text-white transition">Alimentation</Link>
          </div>
        </div>

        {/* Vendre */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Vendre</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/inscription" className="hover:text-white transition">Créer un compte</Link>
            <Link to="/vendeur" className="hover:text-white transition">Mon dashboard</Link>
            <Link to="/api/marketing/plans" className="hover:text-white transition">Nos plans</Link>
          </div>
        </div>

        {/* Aide */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Aide</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/aide" className="hover:text-white transition">Centre d'aide</Link>
            <Link to="/contact" className="hover:text-white transition">Nous contacter</Link>
            <Link to="/cgu" className="hover:text-white transition">CGU</Link>
            <Link to="/confidentialite" className="hover:text-white transition">Confidentialité</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 px-4 text-center text-xs text-white/30">
        © {new Date().getFullYear()} MarketAfrik — Tous droits réservés
      </div>
    </footer>
  );
};

export default Footer;