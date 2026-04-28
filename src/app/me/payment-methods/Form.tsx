"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertPayerAction } from "../actions";

type Initial = {
  display_name?: string | null;
  venmo_handle?: string | null;
  zelle_contact?: string | null;
  cashapp_handle?: string | null;
} | null;

export function PaymentMethodsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
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
        placeholder="Jishnu"
        defaultValue={initial?.display_name ?? ""}
        required
      />
      <Field
        label="Venmo handle"
        name="venmo_handle"
        placeholder="Jishnu-Moorthy"
        defaultValue={initial?.venmo_handle ?? ""}
        prefix="@"
      />
      <Field
        label="Cash App $cashtag"
        name="cashapp_handle"
        placeholder="jishnu"
        defaultValue={initial?.cashapp_handle ?? ""}
        prefix="$"
      />
      <Field
        label="Zelle (phone or email)"
        name="zelle_contact"
        placeholder="you@example.com"
        defaultValue={initial?.zelle_contact ?? ""}
      />

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
