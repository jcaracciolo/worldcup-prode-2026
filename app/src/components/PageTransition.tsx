"use client";

import { usePathname } from "next/navigation";
import { useRef, useLayoutEffect } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Simple fade-in animation on page navigation
 * Uses ref-based class toggling to avoid React render overhead
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const prevPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (pathname !== prevPathname.current && ref.current) {
      // Remove animation class, force reflow, add it back
      ref.current.classList.remove("page-fade-in");
      // Force reflow to restart animation
      void ref.current.offsetWidth;
      ref.current.classList.add("page-fade-in");
      prevPathname.current = pathname;
    }
  }, [pathname]);

  return (
    <div ref={ref} className="page-fade-in flex-1 flex flex-col">
      {children}
    </div>
  );
}
