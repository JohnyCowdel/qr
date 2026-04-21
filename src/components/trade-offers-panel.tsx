"use client";

import { useMemo, useState, useTransition } from "react";

type ResourceType = "MONEY" | "POWER";

type OfferTarget = {
  id: number;
  handle: string;
  teamName: string;
  teamColorHex: string;
};

type TradeOfferListItem = {
  id: number;
  fromUserId: number;
  toUserId: number;
  offerType: ResourceType;
  offerAmount: number;
  requestType: ResourceType;
  requestAmount: number;
  createdAt: string;
  fromUserHandle: string;
  toUserHandle: string;
};

type TradeOffersPanelProps = {
  currentUserId: number;
  targets: OfferTarget[];
  incomingOffers: TradeOfferListItem[];
  outgoingOffers: TradeOfferListItem[];
};

function formatAmount(value: number) {
  return value.toFixed(2);
}

function resourceLabel(type: ResourceType) {
  return type === "MONEY" ? "💰 Peníze" : "⚡ Síla";
}

function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat("cs", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateIso));
}

export function TradeOffersPanel({
  currentUserId,
  targets,
  incomingOffers,
  outgoingOffers,
}: TradeOffersPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const defaultTargetId = useMemo(() => (targets[0] ? String(targets[0].id) : ""), [targets]);

  const [toUserId, setToUserId] = useState(defaultTargetId);
  const [offerType, setOfferType] = useState<ResourceType>("MONEY");
  const [offerAmount, setOfferAmount] = useState("1");
  const [requestType, setRequestType] = useState<ResourceType>("POWER");
  const [requestAmount, setRequestAmount] = useState("0");

  function resetForm() {
    setToUserId(defaultTargetId);
    setOfferType("MONEY");
    setOfferAmount("1");
    setRequestType("POWER");
    setRequestAmount("0");
  }

  async function submitOffer() {
    const parsedToUserId = Number(toUserId);
    const parsedOfferAmount = Number(offerAmount);
    const parsedRequestAmount = Number(requestAmount);

    if (!Number.isInteger(parsedToUserId) || parsedToUserId <= 0) {
      setStatus("Vyber hráče, kterému chceš nabídku poslat.");
      return;
    }

    if (!Number.isFinite(parsedOfferAmount) || parsedOfferAmount <= 0) {
      setStatus("Pole Nabízím musí být kladné číslo.");
      return;
    }

    if (!Number.isFinite(parsedRequestAmount) || parsedRequestAmount < 0) {
      setStatus("Pole Požaduji musí být číslo větší nebo rovno nule.");
      return;
    }

    setStatus("Odesílám nabídku...");

    startTransition(async () => {
      try {
        const response = await fetch("/api/offers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toUserId: parsedToUserId,
            offerType,
            offerAmount: parsedOfferAmount,
            requestType,
            requestAmount: parsedRequestAmount,
          }),
        });

        const result = (await response.json()) as { ok: boolean; message: string };
        if (!response.ok || !result.ok) {
          setStatus(result.message || "Nabídku se nepodařilo vytvořit.");
          return;
        }

        setStatus("Nabídka byla vytvořena.");
        setIsCreating(false);
        resetForm();
        window.location.reload();
      } catch {
        setStatus("Nabídku se nepodařilo vytvořit.");
      }
    });
  }

  async function acceptOffer(offerId: number) {
    setStatus("Přijímám nabídku...");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/offers/${offerId}/accept`, {
          method: "POST",
        });

        const result = (await response.json()) as { ok: boolean; message: string };
        if (!response.ok || !result.ok) {
          setStatus(result.message || "Nabídku se nepodařilo přijmout.");
          return;
        }

        setStatus("Nabídka byla přijata.");
        window.location.reload();
      } catch {
        setStatus("Nabídku se nepodařilo přijmout.");
      }
    });
  }

  return (
    <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Nabídky ⚖️</h2>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)]"
        >
          {isCreating ? "Zavřít" : "Vytvořit nabídku"}
        </button>
      </div>

      {isCreating && (
        <div className="mt-4 space-y-3 rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
          {targets.length ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Komu</span>
                <select
                  value={toUserId}
                  onChange={(event) => setToUserId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none"
                >
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      @{target.handle} ({target.teamName})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Nabízím</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={offerAmount}
                      onChange={(event) => setOfferAmount(event.target.value)}
                      className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none"
                    />
                    <select
                      value={offerType}
                      onChange={(event) => setOfferType(event.target.value as ResourceType)}
                      className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none"
                    >
                      <option value="MONEY">💰</option>
                      <option value="POWER">⚡</option>
                    </select>
                  </div>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Požaduji</span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={requestAmount}
                      onChange={(event) => setRequestAmount(event.target.value)}
                      className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none"
                    />
                    <select
                      value={requestType}
                      onChange={(event) => setRequestType(event.target.value as ResourceType)}
                      className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 outline-none"
                    >
                      <option value="MONEY">💰</option>
                      <option value="POWER">⚡</option>
                    </select>
                  </div>
                </label>
              </div>

              <button
                type="button"
                onClick={submitOffer}
                disabled={isPending}
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                {isPending ? "Ukládám..." : "Potvrdit nabídku"}
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Momentálně není žádný jiný hráč, kterému lze poslat nabídku.</p>
          )}
        </div>
      )}

      {status ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--line)] bg-white/55 px-3 py-2 text-sm text-[var(--muted)]">
          {status}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">Příchozí nabídky</h3>
          <div className="mt-3 space-y-3">
            {incomingOffers.length ? incomingOffers.map((offer) => (
              <div key={offer.id} className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 text-sm">
                <p>
                  <span className="font-semibold">@{offer.fromUserHandle}</span> nabízí <span className="font-semibold">{formatAmount(offer.offerAmount)}</span> {resourceLabel(offer.offerType)}
                  {offer.requestAmount > 0 ? (
                    <>
                      {" "}za <span className="font-semibold">{formatAmount(offer.requestAmount)}</span> {resourceLabel(offer.requestType)}
                    </>
                  ) : (
                    <> jako dar 🎁</>
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Vytvořeno: {formatDate(offer.createdAt)}</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => acceptOffer(offer.id)}
                    disabled={isPending || offer.toUserId !== currentUserId}
                    className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                  >
                    Přijmout nabídku
                  </button>
                </div>
              </div>
            )) : (
              <p className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/55 p-3 text-sm text-[var(--muted)]">Nemáš žádné příchozí nabídky.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold">Odeslané nabídky</h3>
          <div className="mt-3 space-y-3">
            {outgoingOffers.length ? outgoingOffers.map((offer) => (
              <div key={offer.id} className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 text-sm">
                <p>
                  Pro <span className="font-semibold">@{offer.toUserHandle}</span>: nabízíš <span className="font-semibold">{formatAmount(offer.offerAmount)}</span> {resourceLabel(offer.offerType)}
                  {offer.requestAmount > 0 ? (
                    <>
                      {" "}za <span className="font-semibold">{formatAmount(offer.requestAmount)}</span> {resourceLabel(offer.requestType)}
                    </>
                  ) : (
                    <> jako dar 🎁</>
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Vytvořeno: {formatDate(offer.createdAt)}</p>
              </div>
            )) : (
              <p className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/55 p-3 text-sm text-[var(--muted)]">Nemáš žádné odeslané nabídky.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
