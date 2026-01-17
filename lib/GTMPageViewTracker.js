"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendGTMEvent } from "@next/third-parties/google"; // or your own function

export default function GTMPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    sendGTMEvent({
      event: "page_view",
      page_path: pathname,
    });
  }, [pathname]);

  return null;
}
