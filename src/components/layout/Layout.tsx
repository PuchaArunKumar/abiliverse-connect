import { ReactNode, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const mainRef = useRef<HTMLElement>(null);
  // React Router gives the entry the app was opened on the key "default", so
  // the initial page load leaves focus where the browser puts it and only
  // later navigations move it.
  const { key } = useLocation();
  const arrivedByNavigation = key !== "default";

  useEffect(() => {
    if (!arrivedByNavigation) return;
    // Every page renders its own Layout, so a route change unmounts the link
    // that was activated and focus falls to <body>: a screen reader announces
    // nothing and the next Tab starts from the top of the document. Move focus
    // to the new page's content instead, but only when focus really was lost,
    // so a field the page focused on purpose keeps it.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    mainRef.current?.focus({ preventScroll: true });
    // Only on mount: a later change within the same page is not a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      {/* tabIndex -1 lets the skip link and the route-change handler above
          place focus here. It is not a control, so it gets no focus ring. */}
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className="flex-1 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
