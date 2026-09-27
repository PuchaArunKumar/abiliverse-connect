import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * A single-page app keeps the previous page's scroll offset across route
 * changes, so a link from the footer opens the next page part-way down and a
 * screen magnifier user lands somewhere arbitrary. Reset to the top whenever
 * the path changes. Hash-only changes (the skip link) keep the same pathname
 * and are left alone.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export default ScrollToTop;
