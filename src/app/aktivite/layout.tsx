import { AjansShell } from "@/components/layout/ajans-shell";

export default function AktiviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AjansShell>{children}</AjansShell>;
}
