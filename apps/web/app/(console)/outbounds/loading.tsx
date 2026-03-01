import { TranslatedText } from "@/components/i18n/TranslatedText";

export default function OutboundsLoading() {
  return (
    <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
      <TranslatedText text="Loading outbound orders..." />
    </div>
  );
}
