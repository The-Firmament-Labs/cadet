import { cn } from "@/lib/utils"

interface HexagonLogoProps {
  className?: string
}

export function HexagonLogo({ className }: HexagonLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-foreground", className)}
    >
      {/* Center hexagon */}
      <circle cx="24" cy="24" r="3" fill="currentColor" />
      
      {/* Inner ring - 6 circles */}
      <circle cx="24" cy="17" r="3" fill="currentColor" />
      <circle cx="30" cy="20.5" r="3" fill="currentColor" />
      <circle cx="30" cy="27.5" r="3" fill="currentColor" />
      <circle cx="24" cy="31" r="3" fill="currentColor" />
      <circle cx="18" cy="27.5" r="3" fill="currentColor" />
      <circle cx="18" cy="20.5" r="3" fill="currentColor" />
      
      {/* Outer ring - top */}
      <circle cx="24" cy="10" r="2.5" fill="currentColor" />
      <circle cx="30" cy="13" r="2.5" fill="currentColor" />
      <circle cx="18" cy="13" r="2.5" fill="currentColor" />
      
      {/* Outer ring - sides */}
      <circle cx="35" cy="17" r="2.5" fill="currentColor" />
      <circle cx="35" cy="24" r="2.5" fill="currentColor" />
      <circle cx="35" cy="31" r="2.5" fill="currentColor" />
      <circle cx="13" cy="17" r="2.5" fill="currentColor" />
      <circle cx="13" cy="24" r="2.5" fill="currentColor" />
      <circle cx="13" cy="31" r="2.5" fill="currentColor" />
      
      {/* Outer ring - bottom */}
      <circle cx="24" cy="38" r="2.5" fill="currentColor" />
      <circle cx="30" cy="35" r="2.5" fill="currentColor" />
      <circle cx="18" cy="35" r="2.5" fill="currentColor" />
    </svg>
  )
}
