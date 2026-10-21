import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import "@fontsource-variable/plus-jakarta-sans";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import App from "./App.jsx";

const queryClient = new QueryClient({
  // Jika sesi habis (401) di tengah pemakaian, kembali ke halaman login.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (error.status === 401 && query.queryKey[0] !== "me")
        queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  }),
  // Data disegarkan otomatis tiap 1 menit dan setiap jendela kembali aktif.
  defaultOptions: {
    queries: {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
