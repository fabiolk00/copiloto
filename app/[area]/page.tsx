import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BRAND_NAME, getAllSlugs, getAreaBySlug } from "@/lib/guias";
import Header from "@/components/venda/Header";
import Hero from "@/components/venda/Hero";
import BonusAndTestimonials from "@/components/venda/BonusAndTestimonials";
import GuiaSection from "@/components/venda/GuiaSection";
import CaminhoSection from "@/components/venda/CaminhoSection";
import IaSection from "@/components/venda/IaSection";
import HonestSection from "@/components/venda/HonestSection";
import FaqSection from "@/components/venda/FaqSection";
import ClosingSection from "@/components/venda/ClosingSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMetadata, productLd } from "@/lib/seo";
import StickyBuyBar from "@/components/venda/StickyBuyBar";
import { TrilhaProvider } from "@/components/venda/TrilhaProvider";

export function generateStaticParams() {
  return getAllSlugs().map((area) => ({ area }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area: slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) return {};
  return pageMetadata({
    title: `Guia de ${area.name} — ${BRAND_NAME}`,
    description: area.sub,
    path: `/${area.slug}`,
  });
}

export default async function VendaPage({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area: slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();

  return (
    <>
    <JsonLd
      data={[
        productLd(area),
        breadcrumbLd([
          { name: BRAND_NAME, path: "/" },
          { name: `Guia de ${area.name}`, path: `/${area.slug}` },
        ]),
      ]}
    />
      <TrilhaProvider areaSlug={area.slug}>
        <Header />
        <main className="max-md:overflow-x-clip">
          <Hero area={area} />
          <BonusAndTestimonials />
          <div className="relative max-w-[1200px] mx-auto px-10">
            <span className="hidden md:block pointer-events-none absolute left-[69px] top-0 bottom-0 w-px bg-[#DCCFBD]" />
            <GuiaSection area={area} />
            <CaminhoSection area={area} />
          </div>
          <IaSection area={area} />
          <HonestSection area={area} />
          <FaqSection area={area} />
          <ClosingSection area={area} />
        </main>
        <StickyBuyBar area={area.slug} />
      </TrilhaProvider>
    </>
  );
}
