export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Kasulu",
  product:
    process.env.NEXT_PUBLIC_PRODUCT_NAME ??
    process.env.NEXT_PUBLIC_APP_NAME ??
    "Fleet Reporting",
  orgLabel:
    process.env.NEXT_PUBLIC_ORG_LABEL ??
    process.env.NEXT_PUBLIC_BRAND_NAME ??
    "Kasulu",
  opsArea: process.env.NEXT_PUBLIC_OPS_AREA ?? "",
  logoSrc: "/logo.jpg",
  heroSrc: "/front-page.jpg",
} as const;

/** Title for header/login — avoids repeating the org name when product already includes it. */
export function brandDisplayTitle(): { highlight: string; rest: string } {
  const name = brand.name.trim();
  const product = brand.product.trim();
  if (!name) return { highlight: "", rest: product };
  if (product.toLowerCase().startsWith(name.toLowerCase())) {
    return { highlight: name, rest: product.slice(name.length).trim() };
  }
  return { highlight: name, rest: product };
}

export function brandTitle(): string {
  const { highlight, rest } = brandDisplayTitle();
  return rest ? `${highlight} ${rest}`.trim() : highlight;
}
