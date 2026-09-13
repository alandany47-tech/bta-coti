/**
 * Motor de cálculo financiero del cotizador inmobiliario. Se usa tanto en
 * tiempo real en el cliente (slider/inputs) como en el servidor, que siempre
 * recalcula contra el list_price real de la propiedad — nunca confía en los
 * montos que manda el navegador.
 */
export type PricingInput = {
  listPrice: number;
  discountPct: number;
  downPaymentPct: number;
  installmentsCount: number;
  /** % del saldo (tras enganche) que se liquida contra escrituración en vez de en mensualidades. */
  finalPaymentPct: number;
};

export type PricingBreakdown = {
  effectivePrice: number;
  discountAmount: number;
  downPaymentAmount: number;
  balanceAfterDownPayment: number;
  installmentsTotal: number;
  monthlyPaymentAmount: number;
  finalPaymentAmount: number;
};

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calculatePricing({
  listPrice,
  discountPct,
  downPaymentPct,
  installmentsCount,
  finalPaymentPct,
}: PricingInput): PricingBreakdown {
  const safeListPrice = Math.max(0, listPrice || 0);
  const safeDiscountPct = clampPct(discountPct);
  const safeDownPaymentPct = clampPct(downPaymentPct);
  const safeFinalPaymentPct = clampPct(finalPaymentPct);
  const safeInstallments = Math.max(1, Math.floor(installmentsCount) || 1);

  const discountAmount = safeListPrice * (safeDiscountPct / 100);
  const effectivePrice = safeListPrice - discountAmount;
  const downPaymentAmount = effectivePrice * (safeDownPaymentPct / 100);
  const balanceAfterDownPayment = effectivePrice - downPaymentAmount;
  const finalPaymentAmount = balanceAfterDownPayment * (safeFinalPaymentPct / 100);
  const installmentsTotal = balanceAfterDownPayment - finalPaymentAmount;
  const monthlyPaymentAmount = installmentsTotal / safeInstallments;

  return {
    effectivePrice,
    discountAmount,
    downPaymentAmount,
    balanceAfterDownPayment,
    installmentsTotal,
    monthlyPaymentAmount,
    finalPaymentAmount,
  };
}
