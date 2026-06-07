import type { Metadata } from "next";
import { ThemeProvider } from "@mind-studio/ui";
import { mind } from "@mind-studio/ui/themes";
import "./globals.css";
import { FeedbackLauncher } from "@/components/FeedbackLauncher";

export const metadata: Metadata = {
  title: "Mind Builder — wish it, we build it",
  description:
    "Describe the website or app you wish you had, in your own words. We build it and give you a link to share. No coding, no setup. Everything we make stays yours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mind-theme="mind" suppressHydrationWarning>
      <body>
        <ThemeProvider
          theme={mind}
          defaultTheme="dark"
          enableSystem={false}
          storageKey="mind-builder-theme-v2"
        >
          {children}
          <FeedbackLauncher />
        </ThemeProvider>
      </body>
    </html>
  );
}
