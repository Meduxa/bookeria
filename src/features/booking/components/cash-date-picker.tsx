"use client";

import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";

export function CashDatePicker({ value, label }: { value: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Input
      type="date"
      aria-label={label}
      value={value}
      onChange={(e) => e.target.value && router.push(`${pathname}?date=${e.target.value}`)}
      className="h-11 w-44 md:h-9"
    />
  );
}
