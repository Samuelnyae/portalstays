import type { Metadata } from "next";
import "./portal.css";

export const metadata: Metadata = {
  title: "PortalStays Wellbeing Portal",
  description:
    "Private monthly check-in. Employees share their monthly pulse in seconds; HR sees thresholded team averages, never personal answers.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
