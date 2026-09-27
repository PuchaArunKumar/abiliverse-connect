import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageLoading from "@/components/PageLoading";
import ScrollToTop from "@/components/ScrollToTop";
// The homepage ships in the main bundle so first paint needs no extra request;
// every other page loads on demand, which keeps the initial download small.
import Index from "./pages/Index";

const Feed = lazy(() => import("./pages/Feed"));
const Problems = lazy(() => import("./pages/Problems"));
const ProblemDetail = lazy(() => import("./pages/ProblemDetail"));
const ProblemNew = lazy(() => import("./pages/ProblemNew"));
const ProblemEdit = lazy(() => import("./pages/ProblemEdit"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Learn = lazy(() => import("./pages/Learn"));
const Opportunities = lazy(() => import("./pages/Opportunities"));
const Connect = lazy(() => import("./pages/Connect"));
const Pitches = lazy(() => import("./pages/Pitches"));
const PitchNew = lazy(() => import("./pages/PitchNew"));
const PitchDetail = lazy(() => import("./pages/PitchDetail"));
const PitchEdit = lazy(() => import("./pages/PitchEdit"));
const Companion = lazy(() => import("./pages/Companion"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Support = lazy(() => import("./pages/Support"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Security = lazy(() => import("./pages/Security"));
const Profile = lazy(() => import("./pages/Profile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const AccessibilityStatement = lazy(() => import("./pages/AccessibilityStatement"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const App = () => (
  <AccessibilityProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ScrollToTop />
        <AuthProvider>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/problems/new" element={<ProblemNew />} />
          <Route path="/problems/:id" element={<ProblemDetail />} />
          <Route path="/problems/:id/edit" element={<ProtectedRoute><ProblemEdit /></ProtectedRoute>} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
          <Route path="/pitches" element={<Pitches />} />
          <Route path="/pitches/new" element={<ProtectedRoute><PitchNew /></ProtectedRoute>} />
          <Route path="/pitches/:id" element={<PitchDetail />} />
          <Route path="/pitches/:id/edit" element={<ProtectedRoute><PitchEdit /></ProtectedRoute>} />
          <Route path="/companion" element={<ProtectedRoute><Companion /></ProtectedRoute>} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/support" element={<Support />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/accessibility-statement" element={<AccessibilityStatement />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </AccessibilityProvider>
);

export default App;
