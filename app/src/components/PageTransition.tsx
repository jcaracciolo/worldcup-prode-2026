"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, startTransition } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Simple fade transition effect for page navigation
 * Works on all devices with CSS opacity transition
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Only animate if pathname changed
    if (pathname !== previousPathname.current) {
      // Start fade out using startTransition to avoid lint warning
      startTransition(() => {
        setIsTransitioning(true);
      });

      // After fade out, update content and fade in
      const timeout = setTimeout(() => {
        startTransition(() => {
          setDisplayChildren(children);
          setIsTransitioning(false);
        });
        previousPathname.current = pathname;
      }, 150); // Fast transition

      return () => clearTimeout(timeout);
    } else {
      // Same pathname, just update children (for state changes)
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      className={`transition-opacity duration-150 ease-in-out ${
        isTransitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {displayChildren}
    </div>
  );
}
