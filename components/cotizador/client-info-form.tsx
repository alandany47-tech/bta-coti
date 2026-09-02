"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const COUNTRY_CODES = [
  { code: "+52", label: "MX +52" },
  { code: "+1", label: "US/CA +1" },
  { code: "+34", label: "ES +34" },
  { code: "+57", label: "CO +57" },
  { code: "+54", label: "AR +54" },
  { code: "+56", label: "CL +56" },
  { code: "+51", label: "PE +51" },
];

export type ClientInfo = {
  name: string;
  countryCode: string;
  phone: string;
};

export function ClientInfoForm({
  value,
  onChange,
}: {
  value: ClientInfo;
  onChange: (value: ClientInfo) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">
          Nombre del cliente
        </label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Ej. Juan Pérez"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">
          WhatsApp del cliente
        </label>
        <div className="flex gap-2">
          <Select
            value={value.countryCode}
            onChange={(e) =>
              onChange({ ...value, countryCode: e.target.value })
            }
            className="w-28 shrink-0"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input
            value={value.phone}
            onChange={(e) =>
              onChange({
                ...value,
                phone: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            placeholder="55 1234 5678"
            inputMode="numeric"
          />
        </div>
      </div>
    </div>
  );
}
