"use client";

import * as React from "react";

/** Memicu dialog print browser saat halaman struk dibuka dengan ?print=1. */
export function PrintOnLoad() {
  React.useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
