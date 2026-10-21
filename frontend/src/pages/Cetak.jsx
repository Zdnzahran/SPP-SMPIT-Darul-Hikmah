import { useState } from "react";
import { Button, Col, Form, Row, Table } from "react-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { Halaman, Muat, PilihSiswa } from "../komponen.jsx";
import { bulanLabel, rupiah } from "../format.js";

export default function Cetak() {
  const [mode, setMode] = useState("semua"); // semua | kelas | siswa
  const [kelasId, setKelasId] = useState("");
  const [siswa, setSiswa] = useState(null);
  const [menunggak, setMenunggak] = useState(true);
  const [status, setStatus] = useState("aktif");

  const kelas = useQuery({ queryKey: ["kelas"], queryFn: () => api("/kelas") });
  const params = new URLSearchParams({
    status,
    hanya_menunggak: mode === "siswa" ? false : menunggak,
  });
  if (mode === "kelas" && kelasId) params.set("kelas_id", kelasId);
  if (mode === "siswa" && siswa) params.set("siswa_id", siswa.id);
  const siap =
    mode === "semua" ||
    (mode === "kelas" && kelasId) ||
    (mode === "siswa" && siswa);
  const lap = useQuery({
    queryKey: ["laporan", params.toString()],
    queryFn: () => api(`/laporan/sisa-tagihan?${params}`),
    enabled: Boolean(siap),
  });

  return (
    <Halaman
      judul="Cetak sisa tagihan"
      aksi={
        <Button
          className="d-print-none"
          disabled={!lap.isSuccess}
          onClick={() => window.print()}
        >
          Cetak / simpan PDF
        </Button>
      }
    >
      <div className="kartu p-3 mb-3 d-print-none">
        <Row className="g-3 align-items-end">
          <Col md={3}>
            <Form.Label>Cakupan</Form.Label>
            <Form.Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="semua">Semua siswa</option>
              <option value="kelas">Per kelas</option>
              <option value="siswa">Per siswa</option>
            </Form.Select>
          </Col>
          {mode === "kelas" && (
            <Col md={3}>
              <Form.Label>Kelas</Form.Label>
              <Form.Select
                value={kelasId}
                onChange={(e) => setKelasId(e.target.value)}
              >
                <option value="">Pilih kelas</option>
                {kelas.data?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </Form.Select>
            </Col>
          )}
          {mode === "siswa" && (
            <Col md={5}>
              <Form.Label>Siswa</Form.Label>
              <PilihSiswa value={siswa} onChange={setSiswa} />
            </Col>
          )}
          <Col md={2}>
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="aktif">Aktif</option>
              <option value="lulus">Lulus</option>
              <option value="semua">Semua</option>
            </Form.Select>
          </Col>
          {mode !== "siswa" && (
            <Col md={3}>
              <Form.Check
                id="hm"
                type="checkbox"
                label="Hanya yang menunggak"
                checked={menunggak}
                onChange={(e) => setMenunggak(e.target.checked)}
              />
            </Col>
          )}
        </Row>
      </div>

      {!siap && (
        <p className="text-muted d-print-none">
          Pilih {mode === "kelas" ? "kelas" : "siswa"} untuk menampilkan
          pratinjau.
        </p>
      )}
      {siap && (
        <div className="kartu p-3">
          <Muat q={lap}>
            {(d) => (
              <>
                <div className="cetak-kepala">
                  <div className="fw-semibold fs-5">SMPIT Darul Hikmah</div>
                  <div className="fw-semibold">Daftar Sisa Tagihan SPP</div>
                  <div className="small text-muted">
                    Dicetak {d.dicetak_pada} WIB ·{" "}
                    {d.filter.kelas
                      ? `Kelas ${d.filter.kelas}`
                      : d.filter.siswa
                        ? `Siswa ${d.filter.siswa}`
                        : "Semua siswa"}{" "}
                    · Status {d.filter.status} ·{" "}
                    {d.filter.hanya_menunggak
                      ? "hanya yang menunggak"
                      : "termasuk yang lunas"}
                  </div>
                </div>
                {d.baris.length === 0 ? (
                  <p className="text-muted mb-0">
                    Tidak ada data untuk filter ini.
                  </p>
                ) : (
                  <Table bordered size="sm" className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama</th>
                        <th>Kelas</th>
                        <th className="angka">Sisa Bulanan</th>
                        <th>Menunggak Sejak</th>
                        <th className="angka">Sisa Pengembangan</th>
                        <th className="angka">Sisa Tahunan</th>
                        <th className="angka">Total Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.baris.map((b) => (
                        <tr key={b.siswa_id}>
                          <td>{b.no}</td>
                          <td>{b.nama}</td>
                          <td>{b.kelas}</td>
                          <td className="angka">{rupiah(b.sisa_bulanan)}</td>
                          <td>{bulanLabel(b.tunggakan_sejak)}</td>
                          <td className="angka">
                            {rupiah(b.sisa_pengembangan)}
                          </td>
                          <td className="angka">{rupiah(b.sisa_tahunan)}</td>
                          <td className="angka">{rupiah(b.total_sisa)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="fw-semibold">
                        <td colSpan={3}>
                          Total ({d.total.jumlah_siswa} siswa)
                        </td>
                        <td className="angka">
                          {rupiah(d.total.sisa_bulanan)}
                        </td>
                        <td />
                        <td className="angka">
                          {rupiah(d.total.sisa_pengembangan)}
                        </td>
                        <td className="angka">
                          {rupiah(d.total.sisa_tahunan)}
                        </td>
                        <td className="angka">{rupiah(d.total.total_sisa)}</td>
                      </tr>
                    </tfoot>
                  </Table>
                )}
              </>
            )}
          </Muat>
        </div>
      )}
    </Halaman>
  );
}
