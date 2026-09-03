import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Solicitud recibida | ALSASA Inmobiliaria",
  robots: { index: false, follow: false },
};

export default async function GraciasPage({ searchParams }) {
  const params = await searchParams;
  const success = params?.status !== "error";

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--background)" }}>
      <Navbar />
      <section style={{ maxWidth: "720px", margin: "0 auto", padding: "10rem 2rem", textAlign: "center" }}>
        <div style={{ backgroundColor: "var(--surface)", padding: "4rem 2rem", borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.06)" }}>
          <h1 style={{ color: "var(--primary)", marginBottom: "1rem" }}>
            {success ? "¡Solicitud recibida!" : "No pudimos enviar la solicitud"}
          </h1>
          <p style={{ color: "var(--text-light)", lineHeight: 1.7, marginBottom: "2rem" }}>
            {success
              ? "Un asesor de ALSASA revisará tu solicitud y se comunicará contigo."
              : "Inténtalo nuevamente o escríbenos directamente por WhatsApp."}
          </p>
          <Link href="/" style={{ display: "inline-block", color: "white", backgroundColor: "var(--secondary)", padding: "1rem 1.5rem", borderRadius: "8px", textDecoration: "none", fontWeight: "bold" }}>
            Volver a las propiedades
          </Link>
        </div>
      </section>
    </main>
  );
}
