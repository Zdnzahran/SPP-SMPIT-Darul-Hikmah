import { useEffect, useState } from "react";
import { Alert, Button, Form, ListGroup, Spinner } from "react-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api.js";
import { TAMPILAN } from "./tampilan.js";

/** Menampilkan status loading / error (dengan tombol coba lagi) untuk sebuah useQuery; jika sukses memanggil children(data). */
export function Muat({ q, children }) {
  if (q.isPending)
    return (
      <div className="text-center text-muted py-4">
        <Spinner size="sm" className="me-2" />
        Memuat data…
      </div>
    );
  if (q.isError) {
    return (
      <Alert
        variant="danger"
        className="d-flex justify-content-between align-items-center gap-2"
      >
        <span>{q.error.message}</span>
        <Button size="sm" variant="outline-danger" onClick={() => q.refetch()}>
          Coba lagi
        </Button>
      </Alert>
    );
  }
  return children(q.data);
}

export function PesanError({ error }) {
  if (!error) return null;
  return (
    <Alert variant="danger" className="py-2 mb-3">
      {error.message}
    </Alert>
  );
}

export function useDebounce(nilai, ms = 300) {
  const [v, setV] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setV(nilai), ms);
    return () => clearTimeout(t);
  }, [nilai, ms]);
  return v;
}

/** Kotak pencarian siswa berdasarkan nama. onChange menerima objek siswa (atau null saat "Ganti"). */
export function PilihSiswa({ value, onChange, status = "semua" }) {
  const [teks, setTeks] = useState("");
  const kata = useDebounce(teks.trim());
  const hasil = useQuery({
    queryKey: ["pilih-siswa", kata, status],
    queryFn: () =>
      api(`/siswa?status=${status}&per_page=8&q=${encodeURIComponent(kata)}`),
    enabled: kata.length >= 2 && !value,
    refetchInterval: false,
  });

  if (value) {
    return (
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <strong>{value.nama}</strong>
        <span className="text-muted">Kelas {value.kelas}</span>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => onChange(null)}
        >
          Ganti siswa
        </Button>
      </div>
    );
  }
  return (
    <div>
      <Form.Control
        placeholder="Ketik minimal 2 huruf nama siswa"
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        autoComplete="off"
      />
      {kata.length >= 2 && hasil.isSuccess && (
        <ListGroup className="mt-1">
          {hasil.data.data.length === 0 && (
            <ListGroup.Item className="text-muted">
              Siswa tidak ditemukan.
            </ListGroup.Item>
          )}
          {hasil.data.data.map((s) => (
            <ListGroup.Item
              action
              key={s.id}
              onClick={() => {
                onChange(s);
                setTeks("");
              }}
            >
              {s.nama}{" "}
              <span className="text-muted">
                · Kelas {s.kelas}
                {s.status === "lulus" ? " · lulus" : ""}
              </span>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {hasil.isError && (
        <div className="text-danger small mt-1">{hasil.error.message}</div>
      )}
    </div>
  );
}

/** Logo sekolah: memakai /logo.png jika ada, jika tidak memakai logo bawaan. */
export function Logo({ size = 40, className = "" }) {
  const [src, setSrc] = useState(TAMPILAN.logo);
  return (
    <img
      src={src}
      alt={`Logo ${TAMPILAN.namaSekolah}`}
      width={size}
      height={size}
      className={`logo ${className}`}
      onError={() =>
        src !== TAMPILAN.logoCadangan && setSrc(TAMPILAN.logoCadangan)
      }
    />
  );
}

export function Halaman({ judul, sub, aksi, children }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-4 d-print-none">
        <div>
          <h1 className="judul-halaman">{judul}</h1>
          {sub && <p className="sub-halaman">{sub}</p>}
        </div>
        {aksi}
      </div>
      {children}
    </>
  );
}
