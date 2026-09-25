import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: { box: 28, text: "text-base" },
  md: { box: 36, text: "text-lg" },
  lg: { box: 56, text: "text-2xl" },
};

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = true,
  className = "",
}: Props) {
  const s = sizes[size];
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/brand/adnabbit-logo.jpg"
        alt="AdNabbit"
        width={s.box}
        height={s.box}
        className="rounded-full ring-1 ring-accent/30 shadow-glow-sm"
        priority
      />
      {showWordmark && (
        <span className={`font-semibold tracking-tight text-foreground ${s.text}`}>
          Ad<span className="text-accent">Nabbit</span>
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center hover:opacity-90">
      {inner}
    </Link>
  );
}
