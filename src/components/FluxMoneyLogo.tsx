type FluxMoneyLogoProps = {
  className?: string;
  compact?: boolean;
};

export function FluxMoneyLogo({ className = "", compact = false }: FluxMoneyLogoProps) {
  return (
    <a
      href="https://app.fluxmoneyapp.com.br"
      title="Ir para a home"
      aria-label="Ir para a home"
      className={["inline-flex items-center justify-center shrink-0", className].join(" ")}
    >
      <img
        src="/logo_tela_do_app.svg"
        alt="Logo FluxMoney"
        className={[
          "w-auto select-none invert-0 dark:invert-0 dark:brightness-150 dark:contrast-110",
          compact ? "h-[46px] md:h-[52px]" : "h-[80px]",
        ].join(" ")}
      />
    </a>
  );
}