import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Feed from "./pages/Feed";
import Problems from "./pages/Problems";
import ProblemDetail from "./pages/ProblemDetail";
import ProblemNew from "./pages/ProblemNew";
import Jobs from "./pages/Jobs";
import Learn from "./pages/Learn";
import Opportunities from "./pages/Opportunities";
import Connect from "./pages/Connect";
import Pitches from "./pages/Pitches";
import Companion from "./pages/Companion";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Support from "./pages/Support";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Security from "./pages/Security";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AccessibilityStatement from "./pages/AccessibilityStatement";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/problems" element={<Problems />} />
            <Route path="/problems/new" element={<ProblemNew />} />
            <Route path="/problems/:id" element={<ProblemDetail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
            <Route path="/pitches" element={<ProtectedRoute><Pitches /></ProtectedRoute>} />
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
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
