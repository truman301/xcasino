"use client";

interface ChipDisplayProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

export default function ChipDisplay({ amount, size = "md" }: ChipDisplayProps) {
  const sizeClasses = {
    sm: "text-sm gap-1",
    md: "text-base gap-2",
    lg: "text-lg gap-2",
  };

  return (
    <div className={`flex items-center ${sizeClasses[size]}`}>
      <span className="text-xl">🪙</span>
      <span className="font-bold text-[var(--gold)]">{amount.toLocaleString()}</span>
    </div>
  );
}
