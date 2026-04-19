/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'h1connect.vercel.app'] },
  },
};

export default nextConfig;
