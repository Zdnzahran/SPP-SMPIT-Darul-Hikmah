import { useState } from "react";
import { Link } from "react-router-dom";
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
import { Halaman, Muat, PesanError, useDebounce } from "../komponen.jsx";
import { bulanIni, bulanLabel, JENIS, NAMA_JENIS, rupiah } from "../format.js";

const PETUNJUK = {
  bulanan: "Terbit otomatis tiap tanggal 1.",
  pengembangan: "Satu kali tagihan penuh.",
  tahunan: "Terbit tiap awal tahun ajaran (1 Juli), boleh dicicil.",
};
const kunci = (j) => `spp_${j}_id`;

function FormSiswa({ siswa, onSelesai, onHide }) {
  const qc = useQueryClient();
  const edit = Boolean(siswa);
  const kelas = useQuery({ queryKey: ["kelas"], queryFn: () => api("/kelas") });
  const spp = {
    bulanan: useQuery({
      queryKey: ["spp", "bulanan"],
      queryFn: () => api("/spp?jenis=bulanan"),
    }),
    pengembangan: useQuery({
      queryKey: ["spp", "pengembangan"],
      queryFn: () => api("/spp?jenis=pengembangan"),
    }),
    tahunan: useQuery({
      queryKey: ["spp", "tahunan"],
      queryFn: () => api("/spp?jenis=tahunan"),
    }),
  };

  const [f, setF] = useState({
    nama: siswa?.nama ?? "",
    kelas_id: siswa?.kelas_id ?? "",
    mulai: siswa ? siswa.bulan_mulai_tagih.slice(0, 7) : bulanIni(),
    berlaku: bulanIni(),
  });
  const [pakai, setPakai] = useState(() =>
    Object.fromEntries(
      JENIS.map((j) => [j, edit ? Boolean(siswa[kunci(j)]) : j === "bulanan"]),
    ),
  );
  const [ids, setIds] = useState(() =>
    Object.fromEntries(JENIS.map((j) => [j, siswa?.[kunci(j)] ?? ""])),
  );
  const [saldo, setSaldo] = useState({
    bulanan: "",
    pengembangan: "",
    tahunan: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const ditambah = edit
    ? JENIS.filter((j) => !siswa[kunci(j)] && pakai[j])
    : [];
  const dicabut = edit ? JENIS.filter((j) => siswa[kunci(j)] && !pakai[j]) : [];
  const diganti = edit
    ? JENIS.filter(
        (j) =>
          siswa[kunci(j)] &&
          pakai[j] &&
          ids[j] &&
          Number(ids[j]) !== siswa[kunci(j)],
      )
    : [];
  const perluBerlaku = diganti.some((j) => j === "bulanan" || j === "tahunan");

  const simpan = useMutation({
    mutationFn: () => {
      const dasar = {
        nama: f.nama,
        kelas_id: Number(f.kelas_id),
        ...Object.fromEntries(
          JENIS.map((j) => [kunci(j), pakai[j] ? Number(ids[j]) : null]),
        ),
      };
      if (edit)
        return api(`/siswa/${siswa.id}`, {
          method: "PUT",
          body: {
            ...dasar,
            ...(perluBerlaku ? { berlaku_mulai_bulan: `${f.berlaku}-01` } : {}),
          },
        });
      return api("/siswa", {
        method: "POST",
        body: {
          ...dasar,
          bulan_mulai_tagih: `${f.mulai}-01`,
          saldo_awal: Object.fromEntries(
            JENIS.map((j) => [
              `${j}_sudah_dibayar`,
              pakai[j] ? Number(saldo[j]) || 0 : 0,
            ]),
          ),
        },
      });
    },
    onSuccess: (d) => {
      for (const k of ["siswa", "laporan", "kelas"])
        qc.invalidateQueries({ queryKey: [k] });
      onSelesai(d?.peringatan);
    },
  });

  const siap = kelas.data && JENIS.every((j) => spp[j].data);
  const adaPilihan = JENIS.some((j) => pakai[j]);
  const lengkap = adaPilihan && JENIS.every((j) => !pakai[j] || ids[j]);
  const kelasKosong = siap && !kelas.data.length;

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        simpan.mutate();
      }}
    >
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="fs-5">
          {edit ? "Edit siswa" : "Tambah siswa"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!siap && <p className="text-muted">Memuat pilihan kelas dan SPP…</p>}
        {kelasKosong && (
          <Alert variant="warning">
            Isi dulu data <Link to="/kelas">Kelas</Link> sebelum menambah siswa.
          </Alert>
        )}
        <PesanError error={simpan.error} />
        {siap && !kelasKosong && (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Nama siswa</Form.Label>
              <Form.Control
                value={f.nama}
                onChange={set("nama")}
                required
                autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Kelas</Form.Label>
              <Form.Select
                value={f.kelas_id}
                onChange={set("kelas_id")}
                required
              >
                <option value="">Pilih kelas</option>
                {kelas.data.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </Form.Select>
              {edit && (
                <Form.Text>
                  Kenaikan kelas: pilih kelas yang baru, lalu simpan.
                </Form.Text>
              )}
            </Form.Group>

            <Form.Label>Jenis SPP yang ditagihkan</Form.Label>
            {JENIS.map((j) => (
              <div key={j} className={`jenis-blok${pakai[j] ? " aktif" : ""}`}>
                <Form.Check
                  type="checkbox"
                  id={`pakai-${j}`}
                  checked={pakai[j]}
                  onChange={(e) =>
                    setPakai({ ...pakai, [j]: e.target.checked })
                  }
                  label={
                    <>
                      <strong>{NAMA_JENIS[j]}</strong>{" "}
                      <span className="text-muted small ms-1">
                        {PETUNJUK[j]}
                      </span>
                    </>
                  }
                />
                {pakai[j] && (
                  <Row className="g-2 mt-1">
                    <Col md={edit ? 12 : 7}>
                      <Form.Select
                        aria-label={`Golongan SPP ${j}`}
                        value={ids[j]}
                        onChange={(e) =>
                          setIds({ ...ids, [j]: e.target.value })
                        }
                        required
                      >
                        <option value="">Pilih golongan {j}</option>
                        {spp[j].data.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.nama} ({rupiah(x.biaya)})
                          </option>
                        ))}
                      </Form.Select>
                      {spp[j].data.length === 0 && (
                        <Form.Text className="text-danger">
                          Belum ada golongan. Isi di menu{" "}
                          <Link to="/spp">SPP</Link>.
                        </Form.Text>
                      )}
                    </Col>
                    {!edit && (
                      <Col md={5}>
                        <Form.Control
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Sudah dibayar ${j}`}
                          placeholder="Sudah dibayar (Rp), opsional"
                          value={saldo[j]}
                          onChange={(e) =>
                            setSaldo({ ...saldo, [j]: e.target.value })
                          }
                        />
                      </Col>
                    )}
                  </Row>
                )}
              </div>
            ))}
            {!adaPilihan && (
              <div className="text-danger small mb-2">
                Pilih minimal satu jenis SPP.
              </div>
            )}

            {perluBerlaku && (
              <Form.Group className="my-3">
                <Form.Label>Golongan baru berlaku mulai bulan</Form.Label>
                <Form.Control
                  type="month"
                  value={f.berlaku}
                  min={siswa.bulan_mulai_tagih.slice(0, 7)}
                  max={bulanIni()}
                  onChange={set("berlaku")}
                  required
                />
                <Form.Text>
                  Tagihan sebelum bulan ini tidak berubah. Untuk SPP tahunan,
                  berlaku mulai tahun ajaran yang memuat bulan ini.
                </Form.Text>
              </Form.Group>
            )}
            {edit && ditambah.some((j) => j !== "pengembangan") && (
              <Alert variant="warning" className="py-2 small">
                Tagihan{" "}
                {ditambah.filter((j) => j !== "pengembangan").join(" dan ")}{" "}
                akan diterbitkan sejak bulan mulai tagih siswa (
                {bulanLabel(siswa.bulan_mulai_tagih)}).
              </Alert>
            )}
            {edit && dicabut.length > 0 && (
              <Alert variant="warning" className="py-2 small">
                Jenis {dicabut.join(" dan ")} dicabut: tagihannya dihapus. Hanya
                bisa jika belum ada pembayaran untuk jenis itu.
              </Alert>
            )}
            {!edit && (
              <Form.Group className="mt-3">
                <Form.Label>Mulai ditagih bulan</Form.Label>
                <Form.Control
                  type="month"
                  value={f.mulai}
                  onChange={set("mulai")}
                  required
                />
                <Form.Text>
                  Untuk siswa yang masuk tengah tahun atau siswa lama, isi bulan
                  pertama ia ditagih. Kolom "Sudah dibayar" untuk saldo awal
                  siswa lama.
                </Form.Text>
              </Form.Group>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Batal
        </Button>
        <Button
          type="submit"
          disabled={simpan.isPending || !siap || kelasKosong || !lengkap}
        >
          {simpan.isPending ? "Menyimpan…" : "Simpan siswa"}
        </Button>
      </Modal.Footer>
    </Form>
  );
}

export default function Siswa() {
  const qc = useQueryClient();
  const [teks, setTeks] = useState("");
  const q = useDebounce(teks.trim());
  const [kelasId, setKelasId] = useState("");
  const [status, setStatus] = useState("aktif");
  const [menunggak, setMenunggak] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'baru' | objek siswa
  const [peringatan, setPeringatan] = useState(null);

  const kelas = useQuery({ queryKey: ["kelas"], queryFn: () => api("/kelas") });
  const params = new URLSearchParams({
    status,
    page,
    per_page: 25,
    hanya_menunggak: menunggak,
  });
  if (q) params.set("q", q);
  if (kelasId) params.set("kelas_id", kelasId);
  const daftar = useQuery({
    queryKey: ["siswa", params.toString()],
    queryFn: () => api(`/siswa?${params}`),
    placeholderData: (prev) => prev,
  });

  const ubahStatus = useMutation({
    mutationFn: ({ id, status: s }) =>
      api(`/siswa/${id}/status`, { method: "PATCH", body: { status: s } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["siswa"] });
      qc.invalidateQueries({ queryKey: ["laporan"] });
    },
  });
  const hapus = useMutation({
    mutationFn: (id) => api(`/siswa/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["siswa"] });
      qc.invalidateQueries({ queryKey: ["laporan"] });
    },
  });
  const filter = (set) => (e) => {
    set(e.target.type === "checkbox" ? e.target.checked : e.target.value);
    setPage(1);
  };

  return (
    <Halaman
      judul="Siswa"
      aksi={<Button onClick={() => setModal("baru")}>Tambah siswa</Button>}
    >
      {peringatan && (
        <Alert
          variant="warning"
          dismissible
          onClose={() => setPeringatan(null)}
        >
          {peringatan}
        </Alert>
      )}
      <PesanError error={ubahStatus.error || hapus.error} />
      <div className="kartu p-3 mb-3">
        <Row className="g-2 align-items-end">
          <Col md={4}>
            <Form.Label className="small mb-1">Cari nama</Form.Label>
            <Form.Control
              value={teks}
              onChange={(e) => {
                setTeks(e.target.value);
                setPage(1);
              }}
              placeholder="Nama siswa"
            />
          </Col>
          <Col sm={6} md={3}>
            <Form.Label className="small mb-1">Kelas</Form.Label>
            <Form.Select value={kelasId} onChange={filter(setKelasId)}>
              <option value="">Semua kelas</option>
              {kelas.data?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col sm={6} md={2}>
            <Form.Label className="small mb-1">Status</Form.Label>
            <Form.Select value={status} onChange={filter(setStatus)}>
              <option value="aktif">Aktif</option>
              <option value="lulus">Lulus</option>
              <option value="semua">Semua</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Check
              type="checkbox"
              id="menunggak"
              label="Hanya yang menunggak"
              checked={menunggak}
              onChange={filter(setMenunggak)}
            />
          </Col>
        </Row>
      </div>

      <div className="kartu p-3">
        <Muat q={daftar}>
          {({ data, meta }) =>
            data.length === 0 ? (
              <p className="text-muted mb-0">
                Tidak ada siswa yang cocok.{" "}
                {meta.total === 0 && !q && !kelasId && (
                  <>Klik "Tambah siswa" untuk memulai.</>
                )}
              </p>
            ) : (
              <>
                <Table responsive hover className="align-middle mb-2">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Kelas</th>
                      <th className="angka">Bulanan</th>
                      <th className="angka">Pengembangan</th>
                      <th className="angka">Tahunan</th>
                      <th className="angka">Total sisa</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/siswa/${s.id}`}>{s.nama}</Link>{" "}
                          {s.status === "lulus" && (
                            <Badge bg="secondary">Lulus</Badge>
                          )}
                        </td>
                        <td>{s.kelas}</td>
                        <td className="angka">
                          {s.spp_bulanan_id ? (
                            <>
                              {rupiah(s.sisa_bulanan)}
                              {s.saldo_bulanan > 0 && (
                                <div className="small text-success">
                                  saldo {rupiah(s.saldo_bulanan)}
                                </div>
                              )}
                              {s.sisa_bulanan > 0 && (
                                <div className="small text-danger">
                                  sejak {bulanLabel(s.tunggakan_sejak)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="angka">
                          {s.spp_pengembangan_id ? (
                            rupiah(s.sisa_pengembangan)
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="angka">
                          {s.spp_tahunan_id ? (
                            rupiah(s.sisa_tahunan)
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="angka fw-semibold">
                          {rupiah(s.total_sisa)}
                        </td>
                        <td className="text-end text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            onClick={() => setModal(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1"
                            disabled={ubahStatus.isPending}
                            onClick={() => {
                              const lulus = s.status === "aktif";
                              const pesan = lulus
                                ? `Nyatakan ${s.nama} lulus? Tagihan bulanan berikutnya tidak akan terbit lagi.`
                                : `Aktifkan kembali ${s.nama}? Tagihan bulan-bulan yang terlewat akan diterbitkan.`;
                              if (window.confirm(pesan))
                                ubahStatus.mutate({
                                  id: s.id,
                                  status: lulus ? "lulus" : "aktif",
                                });
                            }}
                          >
                            {s.status === "aktif" ? "Luluskan" : "Aktifkan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={hapus.isPending}
                            onClick={() =>
                              window.confirm(
                                `Hapus ${s.nama}? Data disembunyikan dari daftar dan laporan.`,
                              ) && hapus.mutate(s.id)
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
                  <span className="text-muted small">{meta.total} siswa</span>
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

      <Modal
        show={modal !== null}
        onHide={() => setModal(null)}
        centered
        size="lg"
      >
        {modal !== null && (
          <FormSiswa
            key={modal === "baru" ? "baru" : modal.id}
            siswa={modal === "baru" ? null : modal}
            onHide={() => setModal(null)}
            onSelesai={(p) => {
              setModal(null);
              setPeringatan(p ?? null);
            }}
          />
        )}
      </Modal>
    </Halaman>
  );
}
