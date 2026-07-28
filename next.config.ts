import type { NextConfig } from "next";

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_TESTING_MODE === "true"
) {
  throw new Error(
    "NEXT_PUBLIC_TESTING_MODE must not be enabled in a production build."
  );
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
