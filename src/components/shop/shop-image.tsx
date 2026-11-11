"use client";

import { useEffect, useRef, useState } from "react";

export function ShopImage({ src, fallback, alt = "", className, eager = false }: {
  src?: string | null;
  fallback: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const activeSrc = src && src !== failed ? src : fallback;
  useEffect(() => {
    if (src && src !== fallback && image.current?.complete && !image.current.naturalWidth && activeSrc === src) {
      setFailed(src);
    }
  }, [activeSrc, fallback, src]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} src={activeSrc} alt={alt} className={className}
    loading={eager ? "eager" : "lazy"} decoding="async" onError={() => src && activeSrc !== fallback && setFailed(src)} />;
}
