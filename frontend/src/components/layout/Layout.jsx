import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { Toaster } from 'react-hot-toast';

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EE]">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1A18',
            color: '#fff',
            fontSize: '13px',
          },
          success: {
            iconTheme: { primary: '#1B6B3A', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#C0390B', secondary: '#fff' },
          },
        }}
      />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;