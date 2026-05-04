import React from "react";
import { Mic, MicOff } from "lucide-react";

export default function MicButton({ active=false, onToggle }) {
  return (
    <button className={`btn ${active ? "primary": ""}`} onClick={onToggle} aria-pressed={active}>
      {active ? <Mic size={18}/> : <MicOff size={18}/>}
      {active ? "Listening" : "Mic"}
    </button>
  );
}
