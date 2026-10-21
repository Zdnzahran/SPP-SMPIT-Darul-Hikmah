import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  Modal,
  Pagination,
  Row,
  Table,
} from "react-bootstrap";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.js";
import { Halaman, Muat, PesanError, PilihSiswa } from "../komponen.jsx";
import { hariIni, JENIS, NAMA_JENIS, rupiah, tanggalLabel } from "../format.js";

function FormBayar({ siswa }) {
  const detail = useQuery({
    queryKey: ["siswa", "detail", String(siswa.id)],
    queryFn: () => api(`/siswa/${siswa.id}`),
  });
  return (
    <div className="kartu p-3 mb-4">
      <Muat q={detail}>{(d) => <IsiFormBayar d={d} />}</Muat>
    </div>
  );
}

function IsiFormBayar({ d }) {
  const qc = useQueryClient();
  const r = d.ringkasan;
  const punya = JENIS.filter((j) => d.siswa[`spp_${j}_id`]); // hanya jenis yang ditagihkan ke siswa ini
  const [jenis, setJenis] = useState(punya[0]);
  const [tanggal, setTanggal] = useState(hariIni());
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [berhasil, setBerhasil] = useState(null);

  const simpan = useMutation({
    mutationFn: () =>
      api("/pembayaran", {
        method: "POST",
        body: {
          siswa_id: d.siswa.id,
          jenis,
          tanggal,
          nominal: Number(nominal),
          catatan: catatan || null,
        },
      }),
    onSuccess: (res) => {
      setBerhasil(
        `Pembayaran ${rupiah(res.pembayaran.nominal)} (${res.pembayaran.jenis}) tersimpan.`,
      );
      setNominal("");
      setCatatan("");
      for (const k of ["siswa", "pembayaran", "laporan"])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });

  const biaya = d.siswa.biaya_bulanan ?? 0;
  const nom = Number(nominal) || 0;
  let setelah = null;
  if (nom > 0) {
    if (jenis === "bulanan") {
      const sel = r.bulanan.selisih - nom;
      setelah = { sisa: Math.max(sel, 0), saldo: Math.max(-sel, 0) };
    } else
      setelah = {
        sisa: Math.max(r[jenis].sisa - nom, 0),
        saldo: 0,
        lebih: nom > r[jenis].sisa,
      };
  }
  const isi = (n) => {
    setNominal(n > 0 ? String(n) : "");
    setBerhasil(null);
  };

  return (
    <>
      <Row className="g-3 mb-3">
        {punya.includes("bulanan") && (
          <Col sm>
            <div className="text-muted small">Sisa bulanan</div>
            <div className="fw-semibold">{rupiah(r.bulanan.sisa)}</div>
            {r.bulanan.saldo > 0 && (
              <div className="small text-success">
                saldo {rupiah(r.bulanan.saldo)}
              </div>
            )}
          </Col>
        )}
        {punya.includes("tahunan") && (
          <Col sm>
            <div className="text-muted small">Sisa tahunan</div>
            <div className="fw-semibold">{rupiah(r.tahunan.sisa)}</div>
          </Col>
        )}
        {punya.includes("pengembangan") && (
          <Col sm>
            <div className="text-muted small">Sisa pengembangan</div>
            <div className="fw-semibold">{rupiah(r.pengembangan.sisa)}</div>
          </Col>
        )}
      </Row>
      {berhasil && (
        <Alert variant="success" dismissible onClose={() => setBerhasil(null)}>
          {berhasil}
        </Alert>
      )}
      <PesanError error={simpan.error} />
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          setBerhasil(null);
          simpan.mutate();
        }}
      >
        <Row className="g-3">
          <Col md={4}>
            <Form.Label>Jenis SPP</Form.Label>
            <Form.Select
              value={jenis}
              onChange={(e) => {
                setJenis(e.target.value);
                setNominal("");
              }}
            >
              {punya.map((j) => (
                <option key={j} value={j}>
                  {NAMA_JENIS[j]}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={4}>
            <Form.Label>Tanggal bayar</Form.Label>
            <Form.Control
              type="date"
              value={tanggal}
              max={hariIni()}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </Col>
          <Col md={4}>
            <Form.Label>Nominal (Rp)</Form.Label>
            <Form.Control
              type="number"
              min="1"
              step="1"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              required
            />
          </Col>
          <Col xs={12} className="d-flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => isi(r[jenis].sisa)}
            >
              Lunasi sisa
            </Button>
            {jenis === "bulanan" && (
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => isi(r.bulanan.selisih + 12 * biaya)}
              >
                Bayar 12 bulan ke depan
              </Button>
            )}
          </Col>
          <Col xs={12}>
            <Form.Label>Catatan (opsional)</Form.Label>
            <Form.Control
              value={catatan}
              maxLength={255}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </Col>
        </Row>
        {setelah && (
          <Alert
            variant={setelah.lebih ? "danger" : "light"}
            className="mt-3 mb-0 border"
          >
            {setelah.lebih ? (
              `Nominal melebihi sisa tagihan ${jenis} dan akan ditolak.`
            ) : (
              <>
                Setelah pembayaran ini: sisa{" "}
                <strong>{rupiah(setelah.sisa)}</strong>
                {jenis === "bulanan" && (
                  <>
                    , saldo <strong>{rupiah(setelah.saldo)}</strong>
                  </>
                )}
                .
              </>
            )}
          </Alert>
        )}
        <Button type="submit" className="mt-3" disabled={simpan.isPending}>
          {simpan.isPending ? "Menyimpan…" : "Simpan pembayaran"}
        </Button>
      </Form>
    </>
  );
}

function UbahBayar({ p, onHide }) {
  const qc = useQueryClient();
  const [tanggal, setTanggal] = useState(p.tanggal);
  const [nominal, setNominal] = useState(String(p.nominal));
  const [catatan, setCatatan] = useState(p.catatan ?? "");
  const simpan = useMutation({
    mutationFn: () =>
      api(`/pembayaran/${p.id}`, {
        method: "PUT",
        body: { tanggal, nominal: Number(nominal), catatan: catatan || null },
      }),
    onSuccess: () => {
      for (const k of ["siswa", "pembayaran", "laporan"])
        qc.invalidateQueries({ queryKey: [k] });
      onHide();
    },
  });
  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        simpan.mutate();
      }}
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="fs-5">
          Ubah pembayaran {p.siswa}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <PesanError error={simpan.error} />
        <p className="text-muted">
          Jenis: {p.jenis}. Jenis dan siswa tidak bisa diubah; hapus lalu catat
          ulang jika salah.
        </p>
        <Form.Group className="mb-3">
          <Form.Label>Tanggal</Form.Label>
          <Form.Control
            type="date"
            value={tanggal}
            max={hariIni()}
            onChange={(e) => setTanggal(e.target.value)}
            required
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Nominal (Rp)</Form.Label>
          <Form.Control
            type="number"
            min="1"
            step="1"
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            required
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Catatan</Form.Label>
          <Form.Control
            value={catatan}
            maxLength={255}
            onChange={(e) => setCatatan(e.target.value)}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Batal
        </Button>
        <Button type="submit" disabled={simpan.isPending}>
          Simpan perubahan
        </Button>
      </Modal.Footer>
    </Form>
  );
}

export default function Pembayaran() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const idParam = params.get("siswa_id");
  const [siswa, setSiswa] = useState(null);
  const [jenisFilter, setJenisFilter] = useState("");
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [page, setPage] = useState(1);
  const [ubah, setUbah] = useState(null);

  // Datang dari halaman detail siswa: ?siswa_id=...
  useEffect(() => {
    if (idParam && !siswa)
      api(`/siswa/${idParam}`)
        .then((d) =>
          setSiswa({
            id: d.siswa.id,
            nama: d.siswa.nama,
            kelas: d.siswa.kelas,
          }),
        )
        .catch(() => {});
  }, [idParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const pilih = (s) => {
    setSiswa(s);
    setPage(1);
    setParams(s ? { siswa_id: s.id } : {});
  };

  const filter = new URLSearchParams({ page, per_page: 20 });
  if (siswa) filter.set("siswa_id", siswa.id);
  if (jenisFilter) filter.set("jenis", jenisFilter);
  if (dari) filter.set("dari", dari);
  if (sampai) filter.set("sampai", sampai);
  const riwayat = useQuery({
    queryKey: ["pembayaran", filter.toString()],
    queryFn: () => api(`/pembayaran?${filter}`),
    placeholderData: (prev) => prev,
  });

  const hapus = useMutation({
    mutationFn: (id) => api(`/pembayaran/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      for (const k of ["siswa", "pembayaran", "laporan"])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
  const ubahFilter = (set) => (e) => {
    set(e.target.value);
    setPage(1);
  };

  return (
    <Halaman judul="Pembayaran">
      <div className="kartu p-3 mb-3">
        <Form.Label>Siswa</Form.Label>
        <PilihSiswa value={siswa} onChange={pilih} />
      </div>
      {siswa ? (
        <FormBayar key={siswa.id} siswa={siswa} />
      ) : (
        <p className="text-muted">
          Pilih siswa untuk mencatat pembayaran, atau lihat riwayat semua siswa
          di bawah.
        </p>
      )}

      <div className="kartu p-3">
        <h2 className="fs-6 fw-semibold mb-3">
          Riwayat pembayaran {siswa && `· ${siswa.nama}`}
        </h2>
        <Row className="g-2 mb-3">
          <Col sm={4}>
            <Form.Select
              value={jenisFilter}
              onChange={ubahFilter(setJenisFilter)}
              aria-label="Filter jenis"
            >
              <option value="">Semua jenis</option>
              <option value="bulanan">Bulanan</option>
              <option value="pengembangan">Pengembangan</option>
              <option value="tahunan">Tahunan</option>
            </Form.Select>
          </Col>
          <Col sm={4}>
            <Form.Control
              type="date"
              value={dari}
              onChange={ubahFilter(setDari)}
              aria-label="Dari tanggal"
            />
          </Col>
          <Col sm={4}>
            <Form.Control
              type="date"
              value={sampai}
              onChange={ubahFilter(setSampai)}
              aria-label="Sampai tanggal"
            />
          </Col>
        </Row>
        <PesanError error={hapus.error} />
        <Muat q={riwayat}>
          {({ data, meta }) =>
            data.length === 0 ? (
              <p className="text-muted mb-0">
                Tidak ada pembayaran yang cocok.
              </p>
            ) : (
              <>
                <Table responsive hover className="align-middle mb-2">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Siswa</th>
                      <th>Jenis</th>
                      <th className="angka">Nominal</th>
                      <th>Catatan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((p) => (
                      <tr key={p.id}>
                        <td>{tanggalLabel(p.tanggal)}</td>
                        <td>
                          {p.siswa}{" "}
                          <span className="text-muted">· {p.kelas}</span>
                        </td>
                        <td>
                          {p.jenis}{" "}
                          {p.sumber === "saldo_awal" && (
                            <Badge bg="info">saldo awal</Badge>
                          )}
                        </td>
                        <td className="angka">{rupiah(p.nominal)}</td>
                        <td className="text-muted">{p.catatan}</td>
                        <td className="text-end text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            onClick={() => setUbah(p)}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={hapus.isPending}
                            onClick={() =>
                              window.confirm(
                                `Hapus pembayaran ${rupiah(p.nominal)} milik ${p.siswa}? Sisa tagihan akan dihitung ulang.`,
                              ) && hapus.mutate(p.id)
                            }
                          >
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted small">
                    {meta.total} pembayaran
                  </span>
                  {meta.total > meta.per_page && (
                    <Pagination size="sm" className="mb-0">
                      <Pagination.Prev
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      />
                      <Pagination.Item active>{page}</Pagination.Item>
                      <Pagination.Next
                        disabled={page * meta.per_page >= meta.total}
                        onClick={() => setPage(page + 1)}
                      />
                    </Pagination>
                  )}
                </div>
              </>
            )
          }
        </Muat>
      </div>

      <Modal show={ubah !== null} onHide={() => setUbah(null)} centered>
        {ubah && <UbahBayar p={ubah} onHide={() => setUbah(null)} />}
      </Modal>
    </Halaman>
  );
}
