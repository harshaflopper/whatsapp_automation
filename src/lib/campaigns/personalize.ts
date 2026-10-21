/** Pure personalisation helpers, shared by the campaign wizard (browser) and the server. */

export type VariableSource = "first_name" | "full_name" | "city" | "text";
export type VariableMapping = { source: VariableSource; value?: string; fallback?: string };
export type PersonalizableVariable = { label: string; kind: "name" | "detail"; sample?: string };

export const SOURCE_LABEL: Record<VariableSource, string> = {
  first_name: "Customer's first name",
  full_name: "Customer's full name",
  city: "Customer's city",
  text: "Same text for everyone",
};

export function firstName(name: string): string {
  const n = name.trim();
  if (!n || /^(customer|new customer)$/i.test(n)) return "";
  return n.split(/\s+/)[0];
}

export function resolveValue(m: VariableMapping | undefined, c: { name: string; city: string | null }): string {
  if (!m) return "";
  let v = "";
  switch (m.source) {
    case "first_name":
      v = firstName(c.name);
      break;
    case "full_name":
      v = /^(customer|new customer)$/i.test(c.name.trim()) ? "" : c.name.trim();
      break;
    case "city":
      v = c.city?.trim() ?? "";
      break;
    case "text":
      v = m.value?.trim() ?? "";
      break;
  }
  return v || m.fallback?.trim() || "";
}

export function resolveParams(mappings: VariableMapping[], c: { name: string; city: string | null }): string[] {
  return mappings.map((m) => resolveValue(m, c));
}

export function defaultMappings(variables: PersonalizableVariable[]): VariableMapping[] {
  return variables.map((v) =>
    v.kind === "name" ? { source: "first_name", fallback: "there" } : { source: "text", value: "", fallback: "" },
  );
}

export function validateMappings(variables: PersonalizableVariable[], mappings: VariableMapping[]): string | null {
  for (let i = 0; i < variables.length; i++) {
    const m = mappings[i];
    const label = variables[i].label;
    if (!m) return `Fill in "${label}".`;
    if (m.source === "text" && !m.value?.trim()) return `Fill in "${label}".`;
    if (m.source !== "text" && !m.fallback?.trim())
      return `Add a backup word for "${label}" for customers without a ${m.source === "city" ? "city" : "name"}.`;
  }
  return null;
}
