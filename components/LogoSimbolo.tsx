/**
 * Símbolo da marca: círculo com uma trilha de 3 pontos subindo na diagonal
 * (etapas I, II e III; o ponto maior é o próximo passo). Mesmas proporções do
 * handoff (viewBox 64 x 64). Decorativo: o nome da marca vem em texto ao lado.
 * Não alterar proporções nem adicionar sombra ou gradiente.
 */
export default function LogoSimbolo({
  size = 22,
  tinta = "#2A2420",
  destaque = "#4F5A30",
  className,
  style,
}: {
  size?: number;
  /** Círculo. */
  tinta?: string;
  /** Trilha e pontos. Verde-oliva da marca por padrão. */
  destaque?: string;
  className?: string;
  /** Para dimensionar por unidades relativas (ex.: cqw) em vez de px. */
  style?: React.CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <circle cx="32" cy="32" r="27" fill="none" stroke={tinta} strokeWidth="3.5" />
      <line x1="21" y1="42" x2="43" y2="22" stroke={destaque} strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <circle cx="21" cy="42" r="3.5" fill={destaque} opacity=".5" />
      <circle cx="32" cy="32" r="3.5" fill={destaque} opacity=".5" />
      <circle cx="43" cy="22" r="6" fill={destaque} />
    </svg>
  );
}
