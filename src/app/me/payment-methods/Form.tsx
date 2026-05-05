"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertPayerAction } from "../actions";

type Country = "US" | "IN";

type Initial = {
  display_name?: string | null;
  country?: Country | null;
  venmo_handle?: string | null;
  zelle_contact?: string | null;
  cashapp_handle?: string | null;
  upi_id?: string | null;
  paytm_phone?: string | null;
} | null;

export function PaymentMethodsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [country, setCountry] = useState<Country>(initial?.country ?? "US");

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("country", country);
    startTransition(async () => {
      const result = await upsertPayerAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.push("/me");
        router.refresh();
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <Field
        label="Your name"
        name="display_name"
        placeholder="Your name"
        defaultValue={initial?.display_name ?? ""}
        required
      />

      <fieldset>
        <legend className="text-sm text-[var(--color-ink)]">Country</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <CountryRadio
            value="US"
            label="🇺🇸 United States"
            current={country}
            onSelect={setCountry}
          />
          <CountryRadio
            value="IN"
            label="🇮🇳 India"
            current={country}
            onSelect={setCountry}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          We&apos;ll show the right payment apps for where your friends are.
        </p>
      </fieldset>

      {country === "US" ? (
        <>
          <Field
            label="Venmo handle"
            name="venmo_handle"
            placeholder="your-venmo-handle"
            defaultValue={initial?.venmo_handle ?? ""}
            prefix="@"
          />
          <Field
            label="Cash App $cashtag"
            name="cashapp_handle"
            placeholder="yourcashtag"
            defaultValue={initial?.cashapp_handle ?? ""}
            prefix="$"
          />
          <Field
            label="Zelle (phone or email)"
            name="zelle_contact"
            placeholder="phone or email"
            defaultValue={initial?.zelle_contact ?? ""}
          />
        </>
      ) : (
        <>
          <Field
            label="UPI ID (works with GPay, PhonePe, BHIM…)"
            name="upi_id"
            placeholder="yourname@oksbi"
            defaultValue={initial?.upi_id ?? ""}
          />
          <Field
            label="PayTM phone"
            name="paytm_phone"
            placeholder="+91XXXXXXXXXX"
            defaultValue={initial?.paytm_phone ?? ""}
          />
        </>
      )}

      {error ? (
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-sm text-[var(--color-success)]">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="tap w-full px-6 py-3.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function CountryRadio(props: {
  value: Country;
  label: string;
  current: Country;
  onSelect: (c: Country) => void;
}) {
  const selected = props.current === props.value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => props.onSelect(props.value)}
      className={`tap px-3 py-2.5 rounded-[var(--radius-md)] border text-sm font-medium ${
        selected
          ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
          : "bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-divider)]"
      }`}
    >
      {props.label}
    </button>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[var(--color-ink)]">{props.label}</span>
      <div className="mt-1 flex rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-divider)] focus-within:border-[var(--color-accent)] overflow-hidden">
        {props.prefix ? (
          <span className="px-3 flex items-center text-[var(--color-muted)] font-mono">
            {props.prefix}
          </span>
        ) : null}
        <input
          name={props.name}
          placeholder={props.placeholder}
          defaultValue={props.defaultValue}
          required={props.required}
          className="flex-1 px-3 py-3 bg-transparent focus:outline-none"
        />
      </div>
    </label>
  );
}
