import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'admin.alsasa.co' },
      { protocol: 'https', hostname: 'alsasa.co' },
      { protocol: 'https', hostname: 'www.alsasa.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/category/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/tag/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/apartamentos-en-venta/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/propiedades-en-medellin/:path*',
        destination: '/',
        permanent: true,
      }
    ];
  },
};

export default withPWA(nextConfig);
