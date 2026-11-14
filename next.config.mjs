/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/^\/auth\/callback(?:\?|$)/] } },
  experimental: { viewTransition: true },
};
export default nextConfig;
