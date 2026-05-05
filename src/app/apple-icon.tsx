import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" tile. 180×180 is the de-facto Apple standard.
// Renders the Splity wordmark on the brand-blue accent so the home-screen
// shortcut reads as branded instead of a gray default.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1E3A8A",
          color: "#F5F1E8",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          letterSpacing: "-0.05em",
        }}
      >
        <div style={{ fontSize: 110, fontWeight: 700, lineHeight: 1 }}>S</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            marginTop: 4,
            opacity: 0.85,
            letterSpacing: 0,
          }}
        >
          Splity
        </div>
      </div>
    ),
    { ...size }
  );
}
