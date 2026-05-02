import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { removeCanonical, setRobotsMeta } from "@/hooks/useCanonical";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    document.title = "404 — Page Not Found | Edooqoo";
    // SEO: tell Google not to index unknown SPA routes (mitigates "Soft 404" report)
    // Lovable hosting always serves SPA fallback as HTTP 200, so we cannot return a real 404 status.
    // Instead we combine: noindex meta + prerender-status-code=404 hint + removed canonical.
    // Google honors this combination and excludes the URL with reason "noindex" instead of crawling it as content.
    const cleanupRobots = setRobotsMeta("noindex, follow");
    let prerenderMeta: HTMLMetaElement | null = document.querySelector('meta[name="prerender-status-code"]');
    if (!prerenderMeta) {
      prerenderMeta = document.createElement('meta');
      prerenderMeta.name = 'prerender-status-code';
      document.head.appendChild(prerenderMeta);
    }
    prerenderMeta.content = '404';
    removeCanonical();
    return () => {
      cleanupRobots();
      prerenderMeta?.remove();
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
