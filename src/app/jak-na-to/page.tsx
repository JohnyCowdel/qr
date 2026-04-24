import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = {
  title: "Jak na to? – Pravidla hry",
};

export const dynamic = "force-dynamic";

export default async function HowToPage() {
  const settings = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: { dailyLoginReward: true },
  });
  const dailyLoginReward = settings?.dailyLoginReward ?? 8;

  return (
    <main className="terrain-grid min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
          >
            ← Zpět
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.04em]">Jak na to? 📖</h1>
        </div>

        <section className="glass-panel space-y-6 rounded-[28px] border border-[var(--line)] p-6">

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">📱 Co potřebuješ ke hře</h2>
            <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
              <li>📍 Telefon se zapnutou GPS (poloha je nutná pro ověření obsazení lokace).</li>
              <li>🌐 Aktivní mobilní data nebo Wi-Fi pro přístup na herní stránky.</li>
              <li>🛰️ Při obsazování musíš povolit sdílení GPS polohy v prohlížeči.</li>
            </ul>
          </div>

          <hr className="border-[var(--line)]" />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">🗺️ Co je cílem hry?</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Naskenuj QR kód na skutečném místě, ověř svou polohu a obsaď lokaci pro svůj tým.
              Čím více lokací váš tým drží, tím silnější jste. Vyhráváte, když váš tým ovládne na konci hry největší část území.
              {" "}Nejde ale jen o to obsazovat – musíš také rozvíjet své lokace, aby ti přinášely více síly a pomáhaly ti dobývat další území.
            </p>
          </div>

          <hr className="border-[var(--line)]" />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">📍 Obsazování lokací</h2>
            <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
              <li>🚶 Musíš být fyzicky na místě – hra ověří tvou GPS polohu.</li>
              <li>⚡ Obsazení stojí sílu. Cena za obsazení je obrana lokace 🛡️ + 1. Pokud nemáš dost síly, lokaci obsadit nemůžeš.</li>
              <li>🔄 Obsazenou lokaci může kdykoliv přebít jiný hráč s dostatečnou silou.</li>
              <li>🏗️ Když lokaci převezme jiný hráč, přebírá ji se vším, co v ní už bylo vybudováno.</li>
            </ul>
          </div>

          <hr className="border-[var(--line)]" />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">⚙️ Ekonomika hry</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Každá obsazená lokace má obyvatele. Ty obyvatele můžeš přiřadit ke třem
              různým činnostem – a záleží jen na tobě, do čeho investuješ:
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Došla ti síla a nevíš co dál? Nezoufej. Pokud máš aktuální sílu nižší než {dailyLoginReward},
              můžeš si po přihlášení vyzvednout denní odměnu +{dailyLoginReward} síly a znovu nastartovat
              svoje dobrodružství.
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Denní odměnu lze vyzvednout jednou za 24 hodin. Nevyzvednuté odměny se nesčítají.
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
              <li>
                ⚡ <span className="font-medium text-foreground">Síla</span> – potřebuješ ji k obsazování dalších
                lokací. Obsazením ji utrácíš, takže ji musíš průběžně doplňovat. Vyrobená síla jde na účet hráče.
              </li>
              <li>
                💰 <span className="font-medium text-foreground">Peníze</span> – použiješ je k vylepšování své
                lokace. Lepší budovy znamenají silnější základnu. Vyrobené peníze jdou na účet hráče.
              </li>
              <li>
                👨‍👩‍👧 <span className="font-medium text-foreground">Populace</span> – více obyvatel ti umožní
                přidělovat víc pracovníků a tím zvyšovat produkci všeho ostatního. Populace zůstává v lokaci,
                takže při převzetí ji získá nový vlastník lokace.
              </li>
              <li>
                ⏱️ Dělníci v lokaci po 24 hodinách bez změny rozdělení automaticky přestanou pracovat.
                Musíš je znovu poslat do práce v detailu lokace.
              </li>
            </ul>
          </div>

          <hr className="border-[var(--line)]" />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">🤝 Obchod mezi hráči</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">
              V profilu najdeš sekci Nabídky, kde můžeš obchodovat s ostatními hráči.
              Nastavíš, co <span className="font-medium text-foreground">nabízíš</span> (⚡ nebo 💰) a co
              <span className="font-medium text-foreground"> požaduješ</span> zpět.
            </p>
            <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
              <li>📤 Nabídku vytvoříš přes tlačítko Vytvořit nabídku.</li>
              <li>📥 Nabídka se zobrazí v profilu cílového hráče v sekci Nabídky.</li>
              <li>✅ Když hráč nabídku přijme, proběhne transakce automaticky mezi oběma účty.</li>
              <li>🎁 Dar funguje tak, že v poli Požaduji nastavíš hodnotu 0.</li>
              <li>🔒 Obchod lze přijmout jen pokud mají oba hráči dost prostředků na splnění nabídky.</li>
            </ul>
          </div>

          <hr className="border-[var(--line)]" />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">💡 Tipy pro začátek</h2>
            <ul className="space-y-2 text-sm leading-7 text-[var(--muted)]">
              <li>🔋 Hned po obsazení nastav část obyvatel na produkci síly – aby sis doplnil/a co jsi utratil/a.</li>
              <li>🏰 Slabé lokace (nízká obrana) jsou levnější na obsazení a dobrý start.</li>
              <li>🤝 Domluv se s týmem – každý může obsadit jinou lokaci a zvyšovat celkovou moc týmu.</li>
            </ul>
          </div>

        </section>

        <div className="text-center">
          <Link
            href="/auth/register"
            className="inline-block rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            Vytvořit účet a začít hrát →
          </Link>
        </div>
      </div>
    </main>
  );
}
