import Navbar from "@/components/Navbar";

const route = "/administracion-de-arriendos-medellin";
const title = "Administración de arriendos en Medellín | ALSASA";
const description = "¿Tienes una propiedad en Medellín o el Valle de Aburrá? Conoce cómo ALSASA puede acompañarte para ponerla en arriendo y administrarla.";
const whatsapp = "https://wa.me/573134321523?text=" + encodeURIComponent(
  "Hola, equipo de ALSASA. Tengo una propiedad y quiero conocer el servicio de administración de arriendos."
);

export const metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: route },
  openGraph: { title, description, url: route, locale: "es_CO", type: "website" },
};

const steps = [
  ["Cuéntanos sobre tu propiedad", "Comparte el municipio, el tipo de inmueble y en qué etapa estás. Así podremos orientarte sobre el siguiente paso."],
  ["Acordamos cómo ponerla en arriendo", "Revisamos contigo la preparación del inmueble, su difusión y cómo atender las consultas de personas interesadas."],
  ["Definimos el alcance de la administración", "Antes de decidir, conversamos sobre el acompañamiento durante el arriendo, las responsabilidades de cada parte y las condiciones del servicio."],
];

const linkStyle = {
  display: "inline-block", borderRadius: 8, padding: "0.85rem 1.15rem",
  fontWeight: 700, textDecoration: "none", lineHeight: 1.4,
};

export default function AdministracionDeArriendos() {
  return (
    <main style={{ background: "#f4f8fc", color: "#172b4d" }}>
      <Navbar />
      <section aria-labelledby="servicio-title" style={{ background: "#e9f1fa", padding: "clamp(3rem, 8vw, 6rem) 1.25rem" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <p style={{ color: "#01257d", fontWeight: 700, marginBottom: "0.8rem" }}>Para propietarios · ALSASA Inmobiliaria</p>
          <h1 id="servicio-title" style={{ color: "#01257d", fontSize: "clamp(2.2rem, 6vw, 4rem)", lineHeight: 1.1, margin: "0 0 1rem" }}>Administración de arriendos en Medellín</h1>
          <p style={{ maxWidth: 640, fontSize: "1.15rem", lineHeight: 1.7, marginBottom: "1.5rem" }}>Si tienes un inmueble en Medellín o en el Valle de Aburrá, te acompañamos a ponerlo en arriendo y a definir cómo administrarlo. La gestión es digital y cuentas con el apoyo de un asesor.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <a href={whatsapp} style={{ ...linkStyle, background: "#01257d", color: "#fff" }}>
              Quiero arrendar mi propiedad <span aria-hidden="true">·</span> WhatsApp
            </a>
            <a href="/#contacto" style={{ ...linkStyle, border: "2px solid #01257d", background: "#fff", color: "#01257d" }}>Ir al formulario</a>
          </div>
          <p style={{ marginTop: "0.8rem", fontSize: "0.95rem" }}>El formulario solicita correo. Si prefieres no compartirlo, escríbenos por WhatsApp.</p>
        </div>
      </section>
      <section aria-labelledby="proceso-title" style={{ padding: "clamp(2.5rem, 6vw, 4.5rem) 1.25rem", maxWidth: 880, margin: "0 auto", boxSizing: "content-box" }}>
        <h2 id="proceso-title" style={{ color: "#01257d", fontSize: "clamp(1.65rem, 4vw, 2.4rem)", marginBottom: "1.25rem" }}>Cómo te acompañamos</h2>
        <ol style={{ paddingLeft: "1.45rem", margin: 0 }}>
          {steps.map(([step, copy]) => (
            <li key={step} style={{ padding: "0.15rem 0 1rem 0.2rem", lineHeight: 1.65 }}>
              <h3 style={{ color: "#01257d", fontSize: "1.17rem", marginBottom: "0.2rem" }}>{step}</h3>
              <p style={{ margin: 0 }}>{copy}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer style={{ padding: "1.5rem 1.25rem", textAlign: "center", background: "#e9f1fa" }}>
        <a href="/" style={{ color: "#01257d", fontWeight: 700 }}>Volver al inicio de ALSASA</a>
      </footer>
    </main>
  );
}
