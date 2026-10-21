import { Link } from "react-router-dom";
import { Badge, Button, Col, Row, Table } from "react-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarRange, Coins, UserRoundX } from "lucide-react";
import { api } from "../api.js";
import { Muat } from "../komponen.jsx";
import { TAMPILAN } from "../tampilan.js";
import { bulanLabel, rupiah, tanggalLabel } from "../format.js";

const tanggalPanjang = () =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

function Stat({ ikon: Ikon, label, nilai, emas }) {
  return (
    <div className="kartu stat">
      <div className={`stat-ikon${emas ? " emas" : ""}`}>
        <Ikon size={22} aria-hidden="true" />
      </div>
      <div>
        <div className="label">{label}</div>
        <div className="nilai">{nilai}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/auth/me"),
    enabled: false,
  });
  const lap = useQuery({
    queryKey: ["laporan", "ringkasan"],
    queryFn: () => api("/laporan/sisa-tagihan?hanya_menunggak=true"),
  });
  const bayar = useQuery({
    queryKey: ["pembayaran", "terbaru"],
    queryFn: () => api("/pembayaran?per_page=8"),
  });
  const nama = me.data?.username
    ? me.data.username[0].toUpperCase() + me.data.username.slice(1)
    : "Bendahara";

  return (
    <>
      <section
        className="hero foto-latar"
        style={{ "--foto": `url(${TAMPILAN.fotoDasbor})` }}
      >
        <div>
          <div className="tanggal">{tanggalPanjang()}</div>
          <h1>Assalamu’alaikum, {nama}</h1>
        </div>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-3">
          <div>
            <div className="total-label">Total tunggakan saat ini</div>
            <div className="total">
              {lap.data ? rupiah(lap.data.total.total_sisa) : "…"}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <Button as={Link} to="/pembayaran" variant="light">
              Catat pembayaran
            </Button>
            <Button as={Link} to="/cetak/sisa-tagihan" variant="outline-light">
              Cetak sisa tagihan
            </Button>
          </div>
        </div>
      </section>

      <Muat q={lap}>
        {(d) => (
          <>
            <Row className="g-3 mb-4">
              <Col sm={6} xl={3}>
                <Stat
                  ikon={UserRoundX}
                  label="Siswa menunggak"
                  nilai={`${d.total.jumlah_siswa} siswa`}
                />
              </Col>
              <Col sm={6} xl={3}>
                <Stat
                  ikon={CalendarClock}
                  label="Tunggakan SPP bulanan"
                  nilai={rupiah(d.total.sisa_bulanan)}
                />
              </Col>
              <Col sm={6} xl={3}>
                <Stat
                  ikon={CalendarRange}
                  label="Sisa SPP tahunan"
                  nilai={rupiah(d.total.sisa_tahunan)}
                />
              </Col>
              <Col sm={6} xl={3}>
                <Stat
                  ikon={Coins}
                  emas
                  label="Sisa SPP pengembangan"
                  nilai={rupiah(d.total.sisa_pengembangan)}
                />
              </Col>
            </Row>
            <Row className="g-3">
              <Col lg={7}>
                <div className="kartu p-3 p-md-4 h-100">
                  <h2 className="judul-kartu">
                    Siswa dengan tunggakan terbesar
                  </h2>
                  {d.baris.length === 0 ? (
                    <p className="text-muted mb-0">
                      Tidak ada siswa yang menunggak.
                    </p>
                  ) : (
                    <Table responsive hover className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Kelas</th>
                          <th>Sejak</th>
                          <th className="angka">Total sisa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...d.baris]
                          .sort((a, b) => b.total_sisa - a.total_sisa)
                          .slice(0, 8)
                          .map((b) => (
                            <tr key={b.siswa_id}>
                              <td>
                                <Link
                                  to={`/siswa/${b.siswa_id}`}
                                  className="fw-semibold text-decoration-none"
                                >
                                  {b.nama}
                                </Link>
                              </td>
                              <td>{b.kelas}</td>
                              <td>{bulanLabel(b.tunggakan_sejak)}</td>
                              <td className="angka fw-semibold">
                                {rupiah(b.total_sisa)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              </Col>
              <Col lg={5}>
                <div className="kartu p-3 p-md-4 h-100">
                  <h2 className="judul-kartu">Pembayaran terbaru</h2>
                  <Muat q={bayar}>
                    {(b) =>
                      b.data.length === 0 ? (
                        <p className="text-muted mb-0">
                          Belum ada pembayaran.{" "}
                          <Link to="/pembayaran">Catat pembayaran pertama</Link>
                          .
                        </p>
                      ) : (
                        <ul className="list-unstyled mb-0">
                          {b.data.map((p) => (
                            <li
                              key={p.id}
                              className="d-flex justify-content-between align-items-start gap-2 py-2 border-bottom"
                            >
                              <div>
                                <div className="fw-semibold">{p.siswa}</div>
                                <div className="small text-muted">
                                  {tanggalLabel(p.tanggal)} · {p.kelas}{" "}
                                  <Badge
                                    bg={
                                      p.jenis === "bulanan"
                                        ? "success"
                                        : "secondary"
                                    }
                                  >
                                    {p.jenis}
                                  </Badge>
                                </div>
                              </div>
                              <div className="angka fw-semibold">
                                {rupiah(p.nominal)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  </Muat>
                </div>
              </Col>
            </Row>
          </>
        )}
      </Muat>
    </>
  );
}
