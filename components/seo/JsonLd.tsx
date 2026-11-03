/**
 * Única exceção ao "zero dangerouslySetInnerHTML" (ver SECURITY_REVIEW.md):
 * JSON-LD precisa do texto cru dentro do <script>, e o escape do JSX
 * converteria aspas em entidades e quebraria o JSON. Os dados vêm só de
 * constantes do código (lib/guias, lib/seo), nunca de entrada de usuário, e
 * "<" é escapado para impedir fechamento prematuro do <script>.
 */
export function serializeJsonLd(data: object | object[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
