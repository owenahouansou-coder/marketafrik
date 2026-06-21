import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { register as registerApi } from '../../api/auth';
import useAuthStore from '../../stores/authStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const schema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  role: z.enum(['buyer', 'vendor']),
  shop_name: z.string().optional(),
}).refine((data) => {
  if (data.role === 'vendor' && !data.shop_name) return false;
  return true;
}, { message: 'Nom de boutique requis', path: ['shop_name'] });

const Register = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('buyer');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'buyer' },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await registerApi(data);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success('Compte créé ! Vérifiez votre email.');
      if (user.role === 'vendor') navigate('/vendeur');
      else navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F7F3EE] py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-[#F4A100]">Market</span>
            <span className="text-[#1B6B3A]">Afrik</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Créez votre compte gratuitement</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Choix rôle */}
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => { setRole('buyer'); setValue('role', 'buyer'); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                role === 'buyer'
                  ? 'bg-[#1B6B3A] text-white'
                  : 'bg-[#F7F3EE] text-gray-500'
              }`}
            >
              🛒 Acheteur
            </button>
            <button
              type="button"
              onClick={() => { setRole('vendor'); setValue('role', 'vendor'); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                role === 'vendor'
                  ? 'bg-[#1B6B3A] text-white'
                  : 'bg-[#F7F3EE] text-gray-500'
              }`}
            >
              🏪 Vendeur
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Nom complet"
              placeholder="Koffi Mensah"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="votre@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {role === 'vendor' && (
              <Input
                label="Nom de boutique"
                placeholder="Ma Boutique Cotonou"
                error={errors.shop_name?.message}
                {...register('shop_name')}
              />
            )}

            <Button type="submit" size="full" loading={loading}>
              Créer mon compte
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/connexion" className="text-[#1B6B3A] font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;