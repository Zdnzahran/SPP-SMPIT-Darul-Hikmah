import { Link, useParams } from "react-router-dom";
import { Badge, Button, Col, Row, Table } from "react-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.js";
import { Halaman, Muat } from "../komponen.jsx";
import {
  bulanLabel,
  JENIS,
  NAMA_JENIS,
  rupiah,
  tahunAjaranLabel,
  tanggalLabel,
} from "../format.js";

const Angka = ({ label, nilai, catatan, warna }) => (
  <div className="mb-2">
    <div className="text-muted small">{label}</div>
    <div className={`angka-besar ${warna ?? ""}`}>{nilai}</div>
    {catatan && <div className="small text-muted">{catatan}</div>}
  </div>
);

export default function SiswaDetail() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["siswa", "detail", id],
    queryFn: () => api(`/siswa/${id}`),
  });

  return (
    <Muat q={q}>
      {({ siswa, ringkasan: r, tagihan, pembayaran }) => (
        <Halaman
          judul={siswa.nama}
          aksi={
            <Button as={Link} to={`/pembayaran?siswa_id=${siswa.id}`}>
              Catat pembayaran
            </Button>
          }
        >
          <p className="text-muted">
            Kelas {siswa.kelas} · mulai ditagih{" "}
            {bulanLabel(siswa.bulan_mulai_tagih)}{" "}
            <Badge bg={siswa.status === "aktif" ? "success" : "secondary"}>
              {siswa.status === "aktif" ? "Aktif" : "Lulus"}
            </Badge>
            <br />
            {JENIS.filter((j) => siswa[`spp_${j}_id`])
              .map(
                (j) =>
                  `${NAMA_JENIS[j]}: ${siswa[`spp_${j}`]} (${rupiah(siswa[`biaya_${j}`])}${j === "bulanan" ? "/bulan" : j === "tahunan" ? "/tahun" : ""})`,
              )
              .join(" · ")}
          </p>
          <Row className="g-3 mb-4">
            <Col sm={6} lg>
              <div className="kartu p-3 h-100">
                <Angka
                  label="Total sisa"
                  nilai={rupiah(r.total_sisa)}
                  warna={r.total_sisa > 0 ? "text-danger" : "text-success"}
                />
              </div>
            </Col>
            {siswa.spp_bulanan_id && (
              <Col sm={6} lg>
                <div className="kartu p-3 h-100">
                  <Angka
                    label="SPP bulanan: sisa"
                    nilai={rupiah(r.bulanan.sisa)}
                    catatan={
                      r.bulanan.jumlah_bulan_menunggak > 0
                        ? `${r.bulanan.jumlah_bulan_menunggak} bulan menunggak sejak ${bulanLabel(r.bulanan.tunggakan_sejak)}`
                        : "Lunas sampai bulan berjalan"
                    }
                  />
                  {r.bulanan.saldo > 0 && (
                    <div className="text-success small">
                      Saldo lebih bayar {rupiah(r.bulanan.saldo)}, otomatis
                      memotong tagihan berikutnya
                    </div>
                  )}
                </div>
              </Col>
            )}
            {siswa.spp_tahunan_id && (
              <Col sm={6} lg>
                <div className="kartu p-3 h-100">
                  <Angka
                    label="SPP tahunan: sisa"
                    nilai={rupiah(r.tahunan.sisa)}
                    catatan={
                      r.tahunan.jumlah_bulan_menunggak > 0
                        ? `${r.tahunan.jumlah_bulan_menunggak} tahun ajaran menunggak sejak ${tahunAjaranLabel(r.tahunan.tunggakan_sejak)}`
                        : "Lunas sampai tahun ajaran berjalan"
                    }
                  />
                </div>
              </Col>
            )}
            {siswa.spp_pengembangan_id && (
              <Col sm={6} lg>
                <div className="kartu p-3 h-100">
                  <Angka
                    label="SPP pengembangan: sisa"
                    nilai={rupiah(r.pengembangan.sisa)}
                    catatan={`Dibayar ${rupiah(r.pengembangan.total_dibayar)} dari ${rupiah(r.pengembangan.total_tagihan)}`}
                  />
                </div>
              </Col>
            )}
          </Row>

          <Row className="g-3">
            <Col lg={6}>
              <div className="kartu p-3 h-100">
                <h2 className="fs-6 fw-semibold mb-3">Tagihan</h2>
                <Table responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Tagihan</th>
                      <th className="angka">Nominal</th>
                      <th className="angka">Terbayar</th>
                      <th className="angka">Sisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagihan.map((t) => (
                      <tr key={`${t.jenis}-${t.bulan}`}>
                        <td>
                          {t.jenis === "pengembangan"
                            ? "Pengembangan"
                            : t.jenis === "tahunan"
                              ? `Tahunan ${tahunAjaranLabel(t.bulan)}`
                              : bulanLabel(t.bulan)}
                        </td>
                        <td className="angka">{rupiah(t.nominal)}</td>
                        <td className="angka">{rupiah(t.terbayar)}</td>
                        <td className="angka">
                          {t.sisa > 0 ? (
                            <span className="text-danger">
                              {rupiah(t.sisa)}
                            </span>
                          ) : (
                            <Badge bg="success">Lunas</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Col>
            <Col lg={6}>
              <div className="kartu p-3 h-100">
                <h2 className="fs-6 fw-semibold mb-3">Riwayat pembayaran</h2>
                {pembayaran.length === 0 ? (
                  <p className="text-muted mb-0">Belum ada pembayaran.</p>
                ) : (
                  <Table responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Jenis</th>
                        <th className="angka">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pembayaran.map((p) => (
                        <tr key={p.id}>
                          <td>{tanggalLabel(p.tanggal)}</td>
                          <td>
                            {p.jenis}
                            {p.sumber === "saldo_awal" && (
                              <Badge bg="info" className="ms-1">
                                saldo awal
                              </Badge>
                            )}
                            {p.catatan && p.sumber !== "saldo_awal" && (
                              <div className="small text-muted">
                                {p.catatan}
                              </div>
                            )}
                          </td>
                          <td className="angka">{rupiah(p.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
                <div className="small text-muted mt-2">
                  Untuk mengubah atau menghapus pembayaran, buka menu
                  Pembayaran.
                </div>
              </div>
            </Col>
          </Row>
        </Halaman>
      )}
    </Muat>
  );
}
