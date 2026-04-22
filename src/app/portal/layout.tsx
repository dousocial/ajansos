import { AjansShell } from "@/components/layout/ajans-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AjansShell>{children}</AjansShell>;
}
