import React from "react";

export default function QuickChips({ onPick }) {
  const chips = [
    { text: "Open YouTube", value: "Open YouTube" },
    { text: "5m timer", value: "Set a 5 minute timer" },
    { text: "What’s the time?", value: "What’s the time now?" },
  ];
  return (
    <div className="quick-row">
      {chips.map((c, i) => (
        <span key={i} className="quick-chip" onClick={() => onPick?.(c.value)}>
          {c.text}
        </span>
      ))}
    </div>
  );
}
