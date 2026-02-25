"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: () => void }>;
}) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return children;
  if (asChild) {
    return React.cloneElement(children, {
      onClick: () => ctx.setOpen(true),
    });
  }
  return <button type="button" onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DialogContext);
  const { t } = useI18n();
  if (!ctx || !ctx.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30" onClick={() => ctx.setOpen(false)} />
      <div className={cn("relative z-10 w-full max-w-md rounded-xl border bg-white p-6 shadow-lg", className)}>
        {children}
        <button
          type="button"
          onClick={() => ctx.setOpen(false)}
          className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label={t("Close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { t } = useI18n();
  const nextChildren = typeof children === "string" ? t(children) : children;
  return (
    <h3 className={cn("text-base font-semibold", className)} {...props}>
      {nextChildren}
    </h3>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { t } = useI18n();
  const nextChildren = typeof children === "string" ? t(children) : children;
  return (
    <p className={cn("text-sm text-slate-500", className)} {...props}>
      {nextChildren}
    </p>
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />;
}


