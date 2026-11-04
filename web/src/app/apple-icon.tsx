import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon for iPhone (iOS needs a PNG).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2554d9" }}>
        <svg width="140" height="140" viewBox="0 0 512 512">
          <circle cx="228" cy="228" r="112" fill="none" stroke="#fff" strokeWidth="40" />
          <path d="M310 310l92 92" stroke="#fff" strokeWidth="44" strokeLinecap="round" />
          <path d="M182 236l34 34 64-72" fill="none" stroke="#fff" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
