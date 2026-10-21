import { useState } from "react";
import { Button, Form, InputGroup } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { api } from "../api.js";
import { Logo, PesanError } from "../komponen.jsx";
import { TAMPILAN } from "../tampilan.js";

export default function Login() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lihat, setLihat] = useState(false);
  const masuk = useMutation({
    mutationFn: () =>
      api("/auth/login", { method: "POST", body: { username, password } }),
    onSuccess: (data) => qc.setQueryData(["me"], data.bendahara),
  });

  return (
    <div className="login">
      <section
        className="login-foto foto-latar"
        style={{ "--foto": `url(${TAMPILAN.fotoLogin})` }}
        aria-hidden="true"
      >
        <div className="d-flex align-items-center gap-3">
          <Logo size={52} />
          <div className="fw-semibold fs-5">{TAMPILAN.namaSekolah}</div>
        </div>
        <div>
          <h2>{TAMPILAN.tagline}</h2>
          {/* <p className="mb-0" style={{ color: "rgba(255,255,255,.75)" }}>
            Tagihan terbit otomatis setiap tanggal 1, saldo lebih bayar langsung
            memotong tagihan berikutnya.
          </p> */}
        </div>
      </section>

      <section className="login-form-sisi">
        <Form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            masuk.mutate();
          }}
        >
          <div className="d-lg-none mb-4">
            <Logo size={56} />
          </div>
          <h1 className="judul-halaman">Masuk</h1>
          <p className="sub-halaman mb-4">Kelola SPP {TAMPILAN.namaSekolah}.</p>
          <PesanError error={masuk.error} />
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Form.Group>
          <Form.Group className="mb-4">
            <Form.Label>Password</Form.Label>
            <InputGroup>
              <Form.Control
                type={lihat ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button
                variant="outline-secondary"
                onClick={() => setLihat(!lihat)}
                aria-label={
                  lihat ? "Sembunyikan password" : "Tampilkan password"
                }
              >
                {lihat ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </InputGroup>
          </Form.Group>
          <Button
            type="submit"
            size="lg"
            className="w-100"
            disabled={masuk.isPending}
          >
            {masuk.isPending ? "Masuk…" : "Masuk"}
          </Button>
        </Form>
      </section>
    </div>
  );
}
