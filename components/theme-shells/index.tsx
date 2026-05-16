"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import { DocsShell } from "@/components/theme-shells/docs-shell";
import { ExcelShell } from "@/components/theme-shells/excel-shell";
import { JetBrainsShell } from "@/components/theme-shells/jetbrains-shell";
import { PowerPointShell } from "@/components/theme-shells/powerpoint-shell";
import { VisualStudioShell } from "@/components/theme-shells/visual-studio-shell";
import { VsCodeShell } from "@/components/theme-shells/vscode-shell";
import { getThemeOption } from "@/lib/theme";

type ThemeChromeProps = {
  children: ReactNode;
  defaultHeader: ReactNode;
  policyBanner: ReactNode;
  footer: ReactNode;
  chatDock: ReactNode;
};

export function ThemeChrome({ children, defaultHeader, policyBanner, footer, chatDock }: ThemeChromeProps) {
  const { themeId } = useTheme();
  const option = getThemeOption(themeId);

  if (option.shellType === "default") {
    return (
      <div id="page-top" className="layout">
        {defaultHeader}
        {policyBanner}
        {children}
        {footer}
        {chatDock}
      </div>
    );
  }

  const framedContent = (
    <div id="page-top" className="layout theme-shell-page">
      {policyBanner}
      {children}
      {footer}
      {chatDock}
    </div>
  );

  if (option.shellType === "excel") {
    return <ExcelShell option={option}>{framedContent}</ExcelShell>;
  }

  if (option.shellType === "powerpoint") {
    return <PowerPointShell option={option}>{framedContent}</PowerPointShell>;
  }

  if (option.shellType === "docs") {
    return <DocsShell option={option}>{framedContent}</DocsShell>;
  }

  if (option.shellType === "vscode") {
    return <VsCodeShell option={option}>{framedContent}</VsCodeShell>;
  }

  if (option.shellType === "jetbrains") {
    return <JetBrainsShell option={option}>{framedContent}</JetBrainsShell>;
  }

  return <VisualStudioShell option={option}>{framedContent}</VisualStudioShell>;
}
