import { useState } from "react";
import { Button, Col, Form, Row, Table } from "react-bootstrap";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { Halaman, Muat, PesanError } from "../komponen.jsx";
import { rupiah } from "../format.js";

function PanelSpp({ jenis, judul, petunjuk }) {
  const qc = useQueryClient();
  const daftar = useQuery({
    queryKey: ["spp", jenis],
    queryFn: () => api(`/spp?jenis=${jenis}`),
  });
  const [editId, setEditId] = useState(null);
  const [nama, setNama] = useState("");
  const [biaya, setBiaya] = useState("");
  const reset = () => {
    setEditId(null);
    setNama("");
    setBiaya("");
  };

  const simpan = useMutation({
    mutationFn: () =>
      editId
        ? api(`/spp/${editId}`, {
            method: "PUT",
            body: { nama, biaya: Number(biaya) },
          })
        : api("/spp", {
            method: "POST",
            body: { nama, jenis, biaya: Number(biaya) },
          }),
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ["spp"] });
    },
  });
  const hapus = useMutation({
    mutationFn: (id) => api(`/spp/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spp"] }),
  });

  return (
    <div className="kartu p-3 h-100">
      <h2 className="fs-6 fw-semibold">{judul}</h2>
      <p className="text-muted small">{petunjuk}</p>
      <PesanError error={simpan.error || hapus.error} />
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          simpan.mutate();
        }}
        className="mb-3"
      >
        <Row className="g-2 align-items-end">
          <Col sm={6}>
            <Form.Label className="small mb-1">Nama SPP</Form.Label>
            <Form.Control
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />
          </Col>
          <Col sm={3}>
            <Form.Label className="small mb-1">Biaya (Rp)</Form.Label>
            <Form.Control
              type="number"
              min="1"
              step="1"
              value={biaya}
              onChange={(e) => setBiaya(e.target.value)}
              required
            />
          </Col>
          <Col sm={3} className="d-flex gap-1">
            <Button type="submit" disabled={simpan.isPending}>
              {editId ? "Simpan" : "Tambah"}
            </Button>
            {editId && (
              <Button variant="outline-secondary" onClick={reset}>
                Batal
              </Button>
            )}
          </Col>
        </Row>
      </Form>
      <Muat q={daftar}>
        {(rows) =>
          rows.length === 0 ? (
            <p className="text-muted mb-0">Belum ada data. Isi form di atas.</p>
          ) : (
            <Table responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th className="angka">Biaya</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nama}</td>
                    <td className="angka">{rupiah(r.biaya)}</td>
                    <td className="text-end text-nowrap">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-1"
                        onClick={() => {
                          setEditId(r.id);
                          setNama(r.nama);
                          setBiaya(String(r.biaya));
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={hapus.isPending}
                        onClick={() =>
                          window.confirm(`Hapus "${r.nama}"?`) &&
                          hapus.mutate(r.id)
                        }
                      >
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        }
      </Muat>
    </div>
  );
}

export default function Spp() {
  return (
    <Halaman judul="SPP">
      <Row className="g-3">
        <Col xl={4} lg={6}>
          <PanelSpp
            jenis="bulanan"
            judul="SPP Bulanan"
            petunjuk="Ditagih otomatis setiap tanggal 1, setahun penuh. Mengubah biaya tidak mengubah tagihan yang sudah terbit."
          />
        </Col>
        <Col xl={4} lg={6}>
          <PanelSpp
            jenis="pengembangan"
            judul="SPP Pengembangan"
            petunjuk="Dibayar sekali selama 3 tahun SMP. Buat golongan asrama dan non-asrama sebagai nama SPP terpisah."
          />
        </Col>
        <Col xl={4} lg={6}>
          <PanelSpp
            jenis="tahunan"
            judul="SPP Tahunan"
            petunjuk="Terbit sekali setiap awal tahun ajaran (1 Juli), boleh dicicil. Siswa yang masuk tengah tahun langsung ditagih penuh."
          />
        </Col>
      </Row>
    </Halaman>
  );
}
