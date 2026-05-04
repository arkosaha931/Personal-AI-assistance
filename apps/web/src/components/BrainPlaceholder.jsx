import React from "react";

export default function BrainPlaceholder({ state = "idle" }) {
  const label =
    state === "listening" ? "Listening…" :
    state === "thinking"   ? "Thinking…"  :
    state === "speaking"   ? "Speaking…"  : "Idle";

  return (
    <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
      <div style={{
        width: 220, height: 220, borderRadius: "50%",
        border: "1px solid rgba(56,225,255,0.4)",
        boxShadow: "0 0 40px rgba(56,225,255,0.35), inset 0 0 30px rgba(56,225,255,0.15)",
        filter: state==="speaking" ? "brightness(1.2)" : "none",
        transition: "filter 240ms ease"
      }} />
      <div style={{position:"absolute", top: 12, left: 12, fontSize: 12, color:"#A7B7CC"}}>
        Brain (Point-Cloud) — {label}
      </div>
      <div className="hint">Say “Shree…” to begin</div>
    </div>
  );
}
