import { ImageResponse } from "next/og";

// Browser favicon. 32×32 is the canonical favicon size; Next.js auto-emits
// `<link rel="icon">` pointing here. Cream background to match brand.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          background: "#1E3A8A",
          color: "#F5F1E8",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          letterSpacing: "-0.05em",
        }}
      >
        S
      </div>
    ),
    { ...size }
  );
}
