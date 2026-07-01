import Image from "next/image";
import { brand, brandDisplayTitle } from "@/lib/brand";

export function AppBrandBar() {
  const { highlight, rest } = brandDisplayTitle();

  return (
    <header className="app-brand-bar">
      <div className="app-brand-bar__logo-wrap">
        <Image
          src={brand.logoSrc}
          alt={`${brand.name} logo`}
          width={120}
          height={48}
          className="app-brand-bar__logo"
          priority
        />
      </div>
      <div className="app-brand-bar__divider" aria-hidden />
      <div className="app-brand-bar__text">
        <p className="app-brand-bar__title">
          {highlight ? (
            <>
              <span className="app-brand-bar__name">{highlight}</span>
              {rest ? ` ${rest}` : null}
            </>
          ) : (
            rest
          )}
        </p>
        {brand.opsArea ? (
          <p className="app-brand-bar__subtitle">{brand.opsArea}</p>
        ) : null}
      </div>
    </header>
  );
}
