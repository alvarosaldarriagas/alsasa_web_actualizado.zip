import Link from "next/link";

const title = "Política de tratamiento de datos personales";
export const metadata = {
  title,
  description: "Política de datos personales de ALSASA Inmobiliaria: finalidades, derechos y canales para consultas y reclamos.",
  alternates: { canonical: "https://alsasa.co/tratamiento-de-datos" },
  openGraph: {
    title,
    description: "Consulta cómo ALSASA gestiona tus datos y cómo ejercer tus derechos.",
    url: "https://alsasa.co/tratamiento-de-datos",
    type: "website",
    locale: "es_CO",
    siteName: "ALSASA Inmobiliaria",
  },
};
const sections = [
  {
    "title": "1 Responsable y canales de contacto",
    "paragraphs": [
      "Responsable: ALSASA INMOBILIARIA S A S.\nDomicilio y dirección para notificaciones: Carrera 66 #63-48, Calatrava, Itagüí, Antioquia, Colombia.\nCorreo para consultas y reclamos de datos personales: alvaro@alsasa.co.\nTeléfono: +57 313 432 1523.\nÁrea de atención: Gerencia de ALSASA Inmobiliaria.\nSitio web: https://alsasa.co."
    ]
  },
  {
    "title": "2 Alcance y datos que se solicitan",
    "paragraphs": [
      "Para atender una solicitud comercial se podrán recopilar nombre, teléfono, correo, inmueble de interés, preferencias de contacto y mensajes aportados voluntariamente. Se registrarán también la procedencia de la solicitud y la evidencia de autorización. Solo se solicitarán datos pertinentes y necesarios para las finalidades informadas.",
      "Esta política se limita a la captación y atención comercial. La gestión de contratos, estudios de arrendamiento, información financiera, empleados o proveedores requerirá revisar sus tratamientos, finalidades y autorizaciones antes de incorporarlos a este alcance."
    ]
  },
  {
    "title": "3 Finalidades y operaciones",
    "paragraphs": [
      "ALSASA podrá recolectar, registrar, almacenar, consultar, actualizar, usar y suprimir los datos para responder solicitudes; informar sobre el inmueble consultado; coordinar y dar seguimiento a visitas; gestionar la atención en sus herramientas de trabajo; conservar evidencia del consentimiento y atender obligaciones o reclamaciones aplicables.",
      "El contacto sobre la solicitud podrá realizarse por teléfono, WhatsApp o correo, según los datos suministrados y la autorización. El envío periódico de promociones u ofertas de otros inmuebles requerirá una autorización diferenciada y voluntaria, que podrá retirarse. Pedir información sobre un inmueble no se interpretará como aceptación de publicidad indefinida."
    ]
  },
  {
    "title": "4 Autorización y principios",
    "paragraphs": [
      "Salvo las excepciones legales, ALSASA obtendrá autorización previa, expresa e informada y conservará prueba consultable. Informará quién trata los datos, para qué los usa, los derechos del titular y los canales para ejercerlos. El silencio no se considerará autorización. No se exigirá aceptar finalidades publicitarias adicionales para atender una consulta.",
      "El tratamiento se regirá por legalidad, finalidad, libertad, veracidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad. Los campos opcionales se identificarán y su omisión no impedirá el servicio cuando no sean necesarios."
    ]
  },
  {
    "title": "5 Derechos de las personas",
    "paragraphs": [
      "El titular podrá conocer, acceder, actualizar y rectificar sus datos; pedir prueba de su autorización, salvo las excepciones legales; conocer el uso dado a su información; y solicitar la revocatoria de la autorización o la supresión cuando proceda. La supresión o revocatoria puede estar limitada por obligaciones legales o contractuales de conservación.",
      "Podrá presentar quejas ante la Superintendencia de Industria y Comercio, después de agotar el trámite de consulta o reclamo ante ALSASA cuando corresponda. ALSASA atenderá gratuitamente las solicitudes de ejercicio de derechos por los canales indicados en esta política."
    ]
  },
  {
    "title": "6 Datos sensibles y de menores",
    "paragraphs": [
      "Los formularios de captación comercial no solicitarán datos sensibles, como información de salud, biometría, religión u orientación política. La persona no está obligada a suministrarlos. Se evitará incluir información sensible en mensajes libres. Cualquier tratamiento excepcional requerirá revisar la base legal, las garantías y la autorización expresa que corresponda.",
      "La captación comercial no estará dirigida a recopilar datos de menores de edad. Si se identifica información de un menor, se restringirá su uso y se evaluará su eliminación o el cumplimiento de las condiciones legales de protección especial, el interés superior y la intervención de su representante."
    ]
  },
  {
    "title": "7 Acceso de terceros y herramientas tecnológicas",
    "paragraphs": [
      "Solo accederán a los datos las personas autorizadas de ALSASA y los proveedores que deban intervenir en la atención, bajo obligaciones de confidencialidad y seguridad. El uso de formularios de Meta y WhatsApp implica el tratamiento de información por esas plataformas conforme a sus funciones y políticas propias; ALSASA responde por el uso que haga de los datos recibidos.",
      "Antes de incorporar proveedores de CRM, almacenamiento, automatización o IA, ALSASA verificará sus funciones, ubicación del tratamiento y condiciones contractuales. Las transmisiones a encargados y las transferencias a otros responsables, incluso internacionales, se realizarán únicamente cuando exista el mecanismo legal aplicable. La autorización comercial no permite divulgar los datos libremente ni enviarlos a cualquier herramienta."
    ]
  },
  {
    "title": "8 Seguridad y conservación",
    "paragraphs": [
      "ALSASA deberá aplicar controles de acceso según funciones, medidas de autenticación, gestión de permisos, confidencialidad y procedimientos de respaldo, eliminación y atención de incidentes acordes con los riesgos. La adopción de esta política debe acompañarse de la verificación de estas medidas; su redacción no acredita por sí sola su implementación.",
      "Los datos y las bases se conservarán mientras sean necesarios para las finalidades autorizadas y los deberes legales o contractuales aplicables. Al cesar esa necesidad, se eliminarán o anonimizarán de forma segura. ALSASA documentará los plazos y la revisión periódica de sus registros, incluida la depuración de contactos sin una finalidad vigente."
    ]
  },
  {
    "title": "9 Consultas y reclamos",
    "paragraphs": [
      "La solicitud se dirigirá al correo o dirección del apartado 1. Debe identificar al titular o representante, indicar un medio de respuesta y explicar la petición. Para un reclamo se describirán los hechos y se adjuntarán los soportes pertinentes. Se verificará la identidad de forma proporcional, sin exigir datos innecesarios.",
      "Las consultas se atenderán en un máximo de diez días hábiles desde su recepción. Cuando no sea posible, se informará el motivo y la nueva fecha antes del vencimiento; la extensión no superará cinco días hábiles adicionales.",
      "Los reclamos se resolverán en un máximo de quince días hábiles desde el día siguiente a su recepción. Si no es posible, se comunicarán los motivos y la fecha de respuesta antes del vencimiento; la extensión no superará ocho días hábiles adicionales. Si el reclamo está incompleto, se requerirá subsanación dentro de cinco días; transcurridos dos meses desde el requerimiento sin respuesta, se entenderá desistido. Si ALSASA no es competente, trasladará el reclamo a quien corresponda en un máximo de dos días hábiles e informará al interesado. Recibido el reclamo completo, se anotará que está en trámite dentro de dos días hábiles y se mantendrá esa anotación hasta resolverlo."
    ]
  },
  {
    "title": "10 Vigencia y cambios",
    "paragraphs": [
      "Entrada en vigencia: 12 de septiembre de 2026. Las bases estarán vigentes durante el tiempo necesario conforme al apartado 8. La política se publicará en una dirección accesible de alsasa.co. Los cambios sustanciales se informarán antes de implementarlos; un cambio de finalidad que lo requiera dará lugar a una nueva autorización."
    ]
  },
  {
    "title": "Marco normativo de referencia",
    "paragraphs": [
      "Ley 1581 de 2012, especialmente artículos 4, 8, 9, 12, 14 a 18; y disposiciones del Decreto 1377 de 2013 compiladas en el Decreto 1074 de 2015.",
      "SUIN Juriscol · Decreto 1377 de 2013 y referencia a su compilación",
      "Función Pública · Ley 1581 de 2012"
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "40px clamp(20px, 5vw, 48px) 80px", overflowWrap: "anywhere" }}>
      <nav aria-label="Navegación" style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: "#01257D", textDecoration: "underline", fontWeight: 600 }}>ALSASA Inmobiliaria · Inicio</Link>
      </nav>
      <article aria-labelledby="policy-title">
        <header style={{ marginBottom: 32 }}>
          <h1 id="policy-title" style={{ fontFamily: "var(--font-sans)", fontSize: "clamp(1.8rem, 5vw, 2.6rem)", color: "#01257D", marginBottom: 16 }}>{title}</h1>
          <p style={{ marginBottom: 12 }}>ALSASA INMOBILIARIA S A S</p>
          <p style={{ marginBottom: 20 }}>Versión 1.0 · Vigente desde el 12 de septiembre de 2026</p>
          <p>Esta política regula los datos de personas interesadas en inmuebles y servicios de ALSASA recibidos mediante formularios de Meta, la web, WhatsApp, correo y atención comercial. Su finalidad es explicar cómo se gestionan esos datos y cómo ejercer los derechos sobre ellos.</p>
        </header>
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`policy-section-${index}`} style={{ marginBottom: 30 }}>
            <h2 id={`policy-section-${index}`} style={{ fontFamily: "var(--font-sans)", fontSize: "1.25rem", color: "#01257D", marginBottom: 14 }}>{section.title}</h2>
            {section.paragraphs.map((text, paragraphIndex) => (
              <p key={paragraphIndex} style={{ marginBottom: 14, whiteSpace: "pre-line" }}>{text}</p>
            ))}
            {index === 0 && <p><a href="mailto:alvaro@alsasa.co" style={{ textDecoration: "underline", color: "#01257D" }}>Enviar una consulta sobre mis datos</a></p>}
          </section>
        ))}
        <p style={{ marginTop: 32 }}><Link href="/" style={{ textDecoration: "underline", color: "#01257D" }}>Volver a ALSASA Inmobiliaria</Link></p>
      </article>
    </main>
  );
}
