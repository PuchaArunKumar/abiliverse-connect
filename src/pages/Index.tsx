import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import StatsSection from "@/components/home/StatsSection";
import PlatformDirectory from "@/components/home/PlatformDirectory";
import AccessibilityCommitment from "@/components/home/AccessibilityCommitment";
import NewsletterSection from "@/components/home/NewsletterSection";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const Index = () => {
  // Empty: the homepage's title is just the site name.
  useDocumentTitle("");

  return (
    <Layout>
      <HeroSection />
      <StatsSection />
      <PlatformDirectory />
      <AccessibilityCommitment />
      <NewsletterSection />
    </Layout>
  );
};

export default Index;
