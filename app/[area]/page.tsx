import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSlugs, getAreaBySlug } from "@/lib/guias";
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
import { breadcrumbLd, ogImageGuia, pageMetadata, productLd, seoGuia } from "@/lib/seo";
import Breadcrumb from "@/components/site/Breadcrumb";
import GuiasCards from "@/components/site/GuiasCards";
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
  const seo = seoGuia(area);
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/${area.slug}`,
    image: ogImageGuia(area),
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
          { name: "Início", path: "/" },
          { name: `Guia de ${area.name}`, path: `/${area.slug}` },
        ]),
      ]}
    />
      <TrilhaProvider areaSlug={area.slug}>
        <Header />
        <main className="max-md:overflow-x-clip">
          <Breadcrumb atual={`Guia de ${area.name}`} />
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
          <section
            id="outros-guias"
            aria-labelledby="outros-guias-titulo"
            className="max-w-[1200px] mx-auto px-5 md:px-10 pb-12 md:pb-20 flex flex-col gap-4"
          >
            <h2 id="outros-guias-titulo" className="m-0 font-serif font-normal text-[22px] md:text-[32px] leading-[1.15] tracking-[-.015em]">
              Outros guias do Copiloto Carreira
            </h2>
            <GuiasCards excluir={area.slug} />
          </section>
        </main>
        <StickyBuyBar area={area.slug} />
      </TrilhaProvider>
    </>
  );
}
