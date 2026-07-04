/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // O app não usa next/image (thumbnails são gradientes CSS e mídia vem de
    // signed URLs). Desativar o otimizador elimina o endpoint /_next/image e,
    // com ele, os vetores de DoS do Image Optimizer (GHSA-9g9p-9gw9-jx7f etc.).
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
