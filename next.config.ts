import type { NextConfig } from "next";

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_TESTING_MODE === "true" &&
  process.env.ALLOW_PRODUCTION_TESTING_MODE !== "true"
) {
  throw new Error(
    "Production testing mode requires ALLOW_PRODUCTION_TESTING_MODE=true."
  );
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_TESTING_MODE === "true"
) {
  console.warn(
    "Building in pre-launch testing mode. Remove both testing-mode environment variables before launch."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
