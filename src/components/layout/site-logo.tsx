import Image from "next/image";
import { SITE_LOGO, SITE_NAME } from "@/lib/site-brand";
import { cn } from "@/lib/utils";

export function SiteLogo({ theme = "light", className, priority }: {
  theme?: "light" | "dark";
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={SITE_LOGO[theme]}
      alt={SITE_NAME}
      width={SITE_LOGO.width}
      height={SITE_LOGO.height}
      sizes="(max-width: 639px) 220px, 300px"
      className={cn("h-auto max-w-full", className)}
      priority={priority}
    />
  );
}
