import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import { GoogleAnalytics } from '@next/third-parties/google';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: '#0D47A1',
};

export const metadata = {
  metadataBase: new URL('https://alsasa-web.vercel.app'),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Alsasa Inmobiliaria",
  },
  title: {
    default: "Inmobiliaria en Medellín: Venta y Renta de Propiedades | Alsasa",
    template: "%s | Alsasa",
  },
  description: "Encuentra casas, apartamentos y lotes en venta y arriendo en Medellín, Envigado, Sabaneta y Rionegro. En Alsasa Inmobiliaria te ayudamos a encontrar el hogar de tus sueños.",
  keywords: [
    "inmobiliaria medellín", "venta de apartamentos sabaneta", "arriendo propiedades antioquia", 
    "alsasa inmobiliaria", "bienes raíces colombia", "apartamentos en venta medellín", 
    "propiedades en medellín", "comprar casa en antioquia", "casas campestres llanogrande", 
    "inversión inmobiliaria colombia", "agencia de bienes raíces envigado"
  ],
  authors: [{ name: "Alsasa Inmobiliaria" }],
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "https://alsasa-web.vercel.app",
    siteName: "Alsasa Inmobiliaria",
    title: "Alsasa Inmobiliaria | Tu hogar ideal en Antioquia",
    description: "Encuentra casas, apartamentos y lotes en venta y arriendo en Medellín, Envigado, Sabaneta y Rionegro. En Alsasa Inmobiliaria te ayudamos a encontrar el hogar de tus sueños.",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
        alt: "Alsasa Inmobiliaria Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alsasa Inmobiliaria | Venta de Apartamentos y Propiedades",
    description: "Encuentra casas, apartamentos y lotes en venta y arriendo en Medellín, Envigado, Sabaneta y Rionegro. En Alsasa Inmobiliaria te ayudamos a encontrar el hogar de tus sueños.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Optimización implícita para buscadores semánticos: contexto amplio en alternates
  alternates: {
    canonical: 'https://alsasa.co',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <ChatWidget />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
