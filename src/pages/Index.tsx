import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import StatsSection from "@/components/home/StatsSection";
import PlatformDirectory from "@/components/home/PlatformDirectory";
import AccessibilityCommitment from "@/components/home/AccessibilityCommitment";
import NewsletterSection from "@/components/home/NewsletterSection";

const Index = () => {
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
