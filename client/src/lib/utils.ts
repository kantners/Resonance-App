import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The design's px font sizes (text-11, text-15 …, see tailwind.config.ts). Without telling
// tailwind-merge about them it reads "text-15" as a text COLOR and drops it whenever a real
// color class (text-ink, text-muted …) is also present.
const SIZES = ["9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "20", "22", "24", "26", "28", "30", "32", "34", "40", "44", "48"];
const twMerge = extendTailwindMerge({ extend: { classGroups: { "font-size": [{ text: SIZES }] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
