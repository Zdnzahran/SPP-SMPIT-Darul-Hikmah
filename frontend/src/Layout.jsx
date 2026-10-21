import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Alert, Button, Form, Modal, Offcanvas } from "react-bootstrap";
import { useMutation } from "@tanstack/react-query";
import {
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu as IkonMenu,
  Printer,
  ReceiptText,
  School,
  KeyRound,
} from "lucide-react";
import { api } from "./api.js";
import { Logo, PesanError } from "./komponen.jsx";
import { TAMPILAN } from "./tampilan.js";

const MENU = [
  ["/", "Ringkasan", LayoutDashboard],
  ["/siswa", "Siswa", GraduationCap],
  ["/pembayaran", "Pembayaran", ReceiptText],
  ["/spp", "SPP", Landmark],
  ["/kelas", "Kelas", School],
  ["/cetak/sisa-tagihan", "Cetak sisa tagihan", Printer],
];

function GantiPassword({ show, onHide }) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [selesai, setSelesai] = useState(false);
  const ganti = useMutation({
    mutationFn: () =>
      api("/auth/ganti-password", {
        method: "POST",
        body: { password_lama: lama, password_baru: baru },
      }),
    onSuccess: () => {
      setSelesai(true);
      setLama("");
      setBaru("");
    },
  });
  return (
    <Modal show={show} onHide={onHide} centered>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          setSelesai(false);
          ganti.mutate();
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="fs-5">
            Ganti password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selesai && (
            <Alert variant="success">Password berhasil diganti.</Alert>
          )}
          <PesanError error={ganti.error} />
          <Form.Group className="mb-3">
            <Form.Label>Password lama</Form.Label>
            <Form.Control
              type="password"
              value={lama}
              onChange={(e) => setLama(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Password baru (minimal 8 karakter)</Form.Label>
            <Form.Control
              type="password"
              minLength={8}
              value={baru}
              onChange={(e) => setBaru(e.target.value)}
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>
            Tutup
          </Button>
          <Button type="submit" disabled={ganti.isPending}>
            {ganti.isPending ? "Menyimpan…" : "Simpan password"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function IsiSisi({ user, onPilih, onGanti, onKeluar }) {
  return (
    <div className="sisi-isi">
      <div className="merek">
        <Logo size={44} />
        <div>
          <div className="merek-nama">Rekap SPP</div>
          <div className="merek-sekolah">{TAMPILAN.namaSekolah}</div>
        </div>
      </div>
      <nav className="menu" aria-label="Menu utama">
        {MENU.map(([to, label, Ikon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onPilih}
            className={({ isActive }) => `menu-item${isActive ? " aktif" : ""}`}
          >
            <Ikon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sisi-bawah">
        <div className="pengguna">
          <div className="avatar" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="fw-semibold">{user.username}</div>
            <div className="small" style={{ color: "rgba(255,255,255,.6)" }}>
              Bendahara
            </div>
          </div>
        </div>
        <div className="d-grid gap-2">
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => {
              onPilih?.();
              onGanti();
            }}
          >
            <KeyRound size={15} className="me-2" />
            Ganti password
          </Button>
          <Button size="sm" variant="outline-light" onClick={onKeluar}>
            <LogOut size={15} className="me-2" />
            Keluar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ user }) {
  const [gantiPw, setGantiPw] = useState(false);
  const [buka, setBuka] = useState(false);
  const keluar = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSettled: () => window.location.assign("/login"),
  });
  const props = {
    user,
    onGanti: () => setGantiPw(true),
    onKeluar: () => keluar.mutate(),
  };

  return (
    <div className="app">
      <aside className="sisi-tetap d-none d-lg-block d-print-none">
        <IsiSisi {...props} />
      </aside>
      <div className="utama">
        <header className="topbar d-lg-none d-print-none">
          <button
            type="button"
            onClick={() => setBuka(true)}
            aria-label="Buka menu"
          >
            <IkonMenu size={24} />
          </button>
          <Logo size={30} />
          <strong>Rekap SPP</strong>
        </header>
        <main className="konten">
          <Outlet />
        </main>
      </div>
      <Offcanvas
        show={buka}
        onHide={() => setBuka(false)}
        className="sisi-offcanvas d-print-none"
      >
        <Offcanvas.Body className="p-0">
          <IsiSisi {...props} onPilih={() => setBuka(false)} />
        </Offcanvas.Body>
      </Offcanvas>
      <GantiPassword show={gantiPw} onHide={() => setGantiPw(false)} />
    </div>
  );
}
