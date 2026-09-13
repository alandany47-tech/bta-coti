"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { PricingBreakdown } from "@/lib/pricing";

export type FinancialInputs = {
  discountPct: number;
  downPaymentPct: number;
  installmentsCount: number;
  finalPaymentPct: number;
};

function Field({
  label,
  value,
  suffix,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <span className="text-sm font-semibold text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function FinancialCalculator({
  listPrice,
  inputs,
  onChange,
  breakdown,
}: {
  listPrice: number;
  inputs: FinancialInputs;
  onChange: (inputs: FinancialInputs) => void;
  breakdown: PricingBreakdown;
}) {
  const hasFinalPayment = breakdown.finalPaymentAmount > 0.009;
  const hasDiscount = breakdown.discountAmount > 0.009;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        Calculadora financiera
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Descuento"
          value={inputs.discountPct}
          suffix="%"
          min={0}
          max={30}
          step={0.5}
          onChange={(discountPct) => onChange({ ...inputs, discountPct })}
        />
        <Field
          label="Enganche"
          value={inputs.downPaymentPct}
          suffix="%"
          min={0}
          max={100}
          step={1}
          onChange={(downPaymentPct) => onChange({ ...inputs, downPaymentPct })}
        />
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">
            Plazo (meses)
          </label>
          <Input
            type="number"
            min={1}
            max={360}
            value={inputs.installmentsCount}
            onChange={(e) =>
              onChange({
                ...inputs,
                installmentsCount: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </div>
        <Field
          label="Saldo a escrituración"
          value={inputs.finalPaymentPct}
          suffix="%"
          min={0}
          max={100}
          step={1}
          onChange={(finalPaymentPct) => onChange({ ...inputs, finalPaymentPct })}
        />
      </div>

      <div className="mt-5 grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-2">
        <div className="flex justify-between text-sm sm:col-span-2">
          <span className="text-muted">Precio de lista</span>
          <span className={hasDiscount ? "text-muted line-through" : "text-foreground"}>
            {formatCurrency(listPrice)}
          </span>
        </div>
        {hasDiscount && (
          <div className="flex justify-between text-sm sm:col-span-2">
            <span className="text-muted">Precio con descuento</span>
            <span className="text-foreground">
              {formatCurrency(breakdown.effectivePrice)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted">Enganche</span>
          <span className="text-foreground">
            {formatCurrency(breakdown.downPaymentAmount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Mensualidad</span>
          <span className="text-foreground">
            {formatCurrency(breakdown.monthlyPaymentAmount)}
          </span>
        </div>
        {hasFinalPayment && (
          <div className="flex justify-between text-sm sm:col-span-2">
            <span className="text-muted">Saldo a escrituración</span>
            <span className="text-foreground">
              {formatCurrency(breakdown.finalPaymentAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
