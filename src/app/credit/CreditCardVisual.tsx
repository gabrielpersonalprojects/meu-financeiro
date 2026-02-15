type CardDesign = { from: string; to: string };

type Props = {
  nome: string;
  emissor?: string;
  categoria?: string; // <-- NOVO (Platinum, Uniclass, Visa, etc)
  perfil?: string;
  design?: CardDesign;

  limite: number;
  fechamentoDia: number;
  vencimentoDia: number;
};


function ContactlessIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M9 7.5c1.9 2.1 1.9 6.9 0 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 6c2.6 3 2.6 9 0 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M15 4.5c3.4 3.9 3.4 11.1 0 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function CreditCardVisual({
  nome,
  emissor,
  categoria,
  perfil,
  design,
}: Props) {
  const fallback: CardDesign = { from: "#220055", to: "#4600ac" };
  const d = design?.from && design?.to ? design : fallback;

  const labelPerfil = String(perfil || "PF").toUpperCase();

  return (
<div
  className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-sm"
  style={{
    backgroundImage: `linear-gradient(135deg, ${d.from}, ${d.to})`,
    aspectRatio: "85.6 / 54",
  }}
>
      {/* brilho suave */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />

      <div className="relative h-full p-6">
{/* topo: banco + PF/PJ */}
<div className="flex items-start justify-between">
  <div>

<div>
  <div className="text-white/95 text-lg font-semibold leading-none">
    {(emissor && emissor.trim()) ? emissor : "Banco"}
  </div>

</div>

    {/* categoria (abaixo do banco) */}
    {!!(categoria && categoria.trim()) && (
      <div className="mt-1 text-white/80 text-xs font-normal leading-none">
        {categoria}
      </div>
    )}
  </div>

  <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
    {labelPerfil}
  </div>
</div>


<div className="mt-10 -translate-y-2 flex items-center gap-3">
  <div className="h-9 w-12 rounded-lg border border-white/25 bg-white/10" />
  <ContactlessIcon className="h-6 w-6 text-white/85" />
</div>

        {/* titular embaixo */}
        <div className="absolute bottom-5 left-6 right-6">
          <div className="text-white/90 text-sm font-semibold tracking-wide">
            {nome || "Titular"}
          </div>
        </div>
      </div>
    </div>
  );
}
