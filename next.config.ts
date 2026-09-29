import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  // Brauzerlər və botlar avtomatik /favicon.ico istəyir; ikon SVG-dir. Əvvəl 404 qaytarırdı.
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HTTPS-i məcbur et: brauzer bir dəfə HTTPS ilə girəndən sonra
          // 2 il ərzində HTTP-yə düşməyə icazə vermir (preload siyahısına uyğun).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
