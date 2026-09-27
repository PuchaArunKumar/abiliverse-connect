import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PrivacyPolicy = () => {
  useDocumentTitle("Privacy policy");

  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Privacy Policy</h1>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Last updated: September 2026</p>
            <p>
              Abilitiverse is committed to protecting your privacy. This policy explains what
              information we collect, why, and where it is kept.
            </p>
            <h2 className="font-heading text-lg font-semibold text-foreground">Information We Collect</h2>
            <p>
              We collect information you provide when creating an account, submitting content, or
              contacting us, including your email address, the name you choose to show, and any
              profile details you add.
            </p>
            <p>
              If you sign up for updates on the homepage, we keep the email address you give so we
              can send them.
            </p>
            <h2 className="font-heading text-lg font-semibold text-foreground">Stored on Your Device</h2>
            <p>
              Your accessibility settings (text size, contrast, font, motion and link underlining)
              are saved in your browser on your device and are not sent to us. When you sign in, your
              browser also keeps a session token so you stay signed in.
            </p>
            <h2 className="font-heading text-lg font-semibold text-foreground">How We Use Your Information</h2>
            <p>
              We use your information to provide platform services, improve user experience, and
              communicate with you about updates and opportunities.
            </p>
            <h2 className="font-heading text-lg font-semibold text-foreground">Where It Is Stored</h2>
            <p>
              Accounts and the content you post are stored with Supabase, the database and sign-in
              service the platform runs on.
            </p>
            <h2 className="font-heading text-lg font-semibold text-foreground">Contact</h2>
            <p>
              Questions about this policy? Email{" "}
              <a
                href="mailto:puchaarunkumar@gmail.com"
                className="font-semibold text-link underline underline-offset-2 [overflow-wrap:anywhere] hover:text-foreground"
              >
                puchaarunkumar@gmail.com
              </a>
              , or see the{" "}
              <Link
                to="/contact"
                className="font-semibold text-link underline underline-offset-2 hover:text-foreground"
              >
                contact page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PrivacyPolicy;
