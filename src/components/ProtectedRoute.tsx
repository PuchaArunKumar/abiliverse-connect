import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PageLoading from "@/components/PageLoading";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, mfaRequired } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoading />;

  // Someone who has not finished two-factor sign-in goes to the same place as
  // someone signed out: the sign-in page shows them the code prompt. The path
  // is router-relative, so it survives the GitHub Pages base path.
  if (!user || mfaRequired) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
