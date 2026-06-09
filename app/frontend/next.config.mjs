/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@deck.gl/core",
    "@deck.gl/geo-layers",
    "@deck.gl/layers",
    "@deck.gl/react"
  ],
  // Static export only when NEXT_EXPORT is set (the Firebase Hosting / demo
  // build). Leaves the normal dev/server build (Docker `npm run dev`)
  // completely unchanged.
  ...(process.env.NEXT_EXPORT
    ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
    : {})
};

export default nextConfig;
