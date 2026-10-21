import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';
import Layout from './Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Spp from './pages/Spp.jsx';
import Kelas from './pages/Kelas.jsx';
import Siswa from './pages/Siswa.jsx';
import SiswaDetail from './pages/SiswaDetail.jsx';
import Pembayaran from './pages/Pembayaran.jsx';
import Cetak from './pages/Cetak.jsx';

export default function App() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me'), retry: false });
  if (me.isPending) return <div className="p-5 text-center text-muted">Memuat…</div>;
  const masuk = me.status === 'success';

  return (
    <Routes>
      <Route path="/login" element={masuk ? <Navigate to="/" replace /> : <Login />} />
      <Route element={masuk ? <Layout user={me.data} /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/spp" element={<Spp />} />
        <Route path="/kelas" element={<Kelas />} />
        <Route path="/siswa" element={<Siswa />} />
        <Route path="/siswa/:id" element={<SiswaDetail />} />
        <Route path="/pembayaran" element={<Pembayaran />} />
        <Route path="/cetak/sisa-tagihan" element={<Cetak />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
