import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import Layout from '../components/layout/Layout';

// Pages publiques
import Home from '../pages/public/Home';
import ProductDetail from '../pages/public/ProductDetail';
import CategoryList from '../pages/public/CategoryList';
import VendorShop from '../pages/public/VendorShop';
import Login from '../pages/public/Login';
import Register from '../pages/public/Register';

// Pages acheteur
import Cart from '../pages/buyer/Cart';
import Checkout from '../pages/buyer/Checkout';
import Orders from '../pages/buyer/Orders';
import Messages from '../pages/buyer/Messages';

// Pages vendeur
import VendorDashboard from '../pages/vendor/VendorDashboard';
import ProductList from '../pages/vendor/ProductList';
import ProductForm from '../pages/vendor/ProductForm';

// Pages admin
import AdminDashboard from '../pages/admin/AdminDashboard';

// Guard auth
const RequireAuth = ({ role }) => {
  const { isAuth, user } = useAuthStore();
  if (!isAuth) return <Navigate to="/connexion" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/produits" element={<CategoryList />} />
        <Route path="/produits/:id" element={<ProductDetail />} />
        <Route path="/categorie/:slug" element={<CategoryList />} />
        <Route path="/boutique/:id" element={<VendorShop />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/inscription" element={<Register />} />

        {/* Acheteur */}
        <Route element={<RequireAuth />}>
          <Route path="/panier" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/mes-commandes" element={<Orders />} />
          <Route path="/messages" element={<Messages />} />
        </Route>

        {/* Vendeur */}
        <Route element={<RequireAuth role="vendor" />}>
          <Route path="/vendeur" element={<VendorDashboard />} />
          <Route path="/vendeur/produits" element={<ProductList />} />
          <Route path="/vendeur/produits/nouveau" element={<ProductForm />} />
          <Route path="/vendeur/produits/:id/modifier" element={<ProductForm />} />
        </Route>

        {/* Admin */}
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;