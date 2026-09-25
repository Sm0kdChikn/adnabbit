import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  MarketingHeader,
  Hero,
  DualPaths,
  HowItWorks,
  SocialProof,
  MarketingFooter,
} from "@/components/marketing";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user?.role === "HOST") redirect("/host");
  if (session?.user?.role === "ADVERTISER") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <Hero />
        <DualPaths />
        <HowItWorks />
        <SocialProof />
        <MarketingFooter />
      </main>
    </div>
  );
}
