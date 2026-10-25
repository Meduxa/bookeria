import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

const RING: Record<string, string> = {
  green: "ring-staff-green",
  teal: "ring-staff-teal",
  sky: "ring-staff-sky",
  blue: "ring-staff-blue",
  indigo: "ring-staff-indigo",
  violet: "ring-staff-violet",
  pink: "ring-staff-pink",
  rose: "ring-staff-rose",
  orange: "ring-staff-orange",
  amber: "ring-staff-amber",
};

// Photo or initials, with the staff colour as a ring (same colour as in the calendar).
export function StaffAvatar({
  name,
  color,
  photoUrl,
  size = "md",
}: {
  name: string;
  color: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-offset-2 ring-offset-card",
        RING[color] ?? "ring-border",
        size === "lg" ? "size-16 text-lg" : "size-10 text-sm",
      )}
      aria-hidden
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar from our own storage
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name, "")
      )}
    </span>
  );
}
