import { useState } from 'react';
import { Button, Form, InputGroup, Table } from 'react-bootstrap';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import { Halaman, Muat, PesanError } from '../komponen.jsx';

export default function Kelas() {
  const qc = useQueryClient();
  const daftar = useQuery({ queryKey: ['kelas'], queryFn: () => api('/kelas') });
  const [nama, setNama] = useState('');
  const [editId, setEditId] = useState(null);
  const reset = () => { setNama(''); setEditId(null); };

  const simpan = useMutation({
    mutationFn: () => editId ? api(`/kelas/${editId}`, { method: 'PUT', body: { nama } }) : api('/kelas', { method: 'POST', body: { nama } }),
    onSuccess: () => { reset(); qc.invalidateQueries({ queryKey: ['kelas'] }); qc.invalidateQueries({ queryKey: ['siswa'] }); },
  });
  const hapus = useMutation({ mutationFn: (id) => api(`/kelas/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['kelas'] }) });

  return (
    <Halaman judul="Kelas">
      <div className="kartu p-3" style={{ maxWidth: 640 }}>
        <PesanError error={simpan.error || hapus.error} />
        <Form onSubmit={(e) => { e.preventDefault(); simpan.mutate(); }} className="mb-3">
          <InputGroup>
            <Form.Control placeholder="Nama kelas, mis. VII A" value={nama} onChange={(e) => setNama(e.target.value)} required />
            <Button type="submit" disabled={simpan.isPending}>{editId ? 'Simpan' : 'Tambah kelas'}</Button>
            {editId && <Button variant="outline-secondary" onClick={reset}>Batal</Button>}
          </InputGroup>
        </Form>
        <Muat q={daftar}>
          {(rows) => rows.length === 0 ? <p className="text-muted mb-0">Belum ada kelas. Tambahkan kelas pertama di atas.</p> : (
            <Table responsive className="mb-0 align-middle">
              <thead><tr><th>Kelas</th><th className="angka">Siswa aktif</th><th /></tr></thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id}>
                    <td>{k.nama}</td><td className="angka">{k.jumlah_siswa_aktif}</td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="outline-primary" className="me-1" onClick={() => { setEditId(k.id); setNama(k.nama); }}>Edit</Button>
                      <Button size="sm" variant="outline-danger" onClick={() => window.confirm(`Hapus kelas "${k.nama}"?`) && hapus.mutate(k.id)}>Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Muat>
      </div>
    </Halaman>
  );
}
