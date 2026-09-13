import logoUrl from "@/styles/monfil-logo.svg";

export interface MonfilLogoProps {
  className?: string;
}

export default function MonfilLogo({ className }: MonfilLogoProps) {
  return <img src={logoUrl} alt="Monfil" className={className} />;
}
