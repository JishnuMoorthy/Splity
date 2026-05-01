export type Payer = {
  id: string;
  user_id: string;
  phone: string;
  display_name: string;
  venmo_handle: string | null;
  zelle_contact: string | null;
  cashapp_handle: string | null;
};

export type BillItem = {
  id: string;
  bill_id: string;
  name: string;
  price_cents: number;
  quantity: number;
  is_shared: boolean;
  position: number;
};

export type Bill = {
  id: string;
  short_id: string;
  payer_id: string;
  receipt_image_path: string | null;
  restaurant_name: string | null;
  subtotal_cents: number;
  tax_cents: number;
  tip_cents: number;
  total_cents: number;
  status: "active" | "closed";
  created_at: string;
  expires_at: string;
};

export type Claim = {
  id: string;
  bill_id: string;
  claimer_name: string | null;
  claimer_session_id: string;
  total_cents: number;
  payment_method: "venmo" | "zelle" | "cashapp" | "other" | null;
  paid_at: string | null;
  created_at: string;
};

export type ClaimItem = {
  claim_id: string;
  item_id: string;
  share_fraction: number;
  units: number;
};

export type PublicBill = {
  short_id: string;
  restaurant_name: string | null;
  subtotal_cents: number;
  tax_cents: number;
  tip_cents: number;
  total_cents: number;
  has_receipt: boolean;
  // Sum of claims.total_cents on this bill — what payees have committed to.
  // Note: counts both unpaid and paid claims (status is tracked separately).
  claimed_total_cents: number;
  payer: {
    display_name: string;
    venmo_handle: string | null;
    zelle_contact: string | null;
    cashapp_handle: string | null;
  };
  items: Array<{
    id: string;
    name: string;
    price_cents: number;
    quantity: number;
    is_shared: boolean;
    position: number;
    assigned_to: string | null;
    claimed_units: number;
    claimed_by: Array<{
      name: string | null;
      share_fraction: number;
      units: number;
    }>;
  }>;
};
