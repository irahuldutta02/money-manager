import { Button } from "./Button";
import { CategoryIcon } from "@/components/CategoryIcon";

/** `icon` is an icon slug from the registry (e.g. "receipt", "target"). */
export function EmptyState({ icon, title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center px-8 py-8 text-center">
      <div
        className="mb-4 flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent shadow-card"
        aria-hidden
      >
        <CategoryIcon icon={icon} size={36} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {message ? (
        <p className="mt-1.5 max-w-xs text-label-2">{message}</p>
      ) : null}
      {actionLabel ? (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center px-8 py-14 text-center"
    >
      <div
        className="mb-4 flex size-20 items-center justify-center rounded-full bg-danger/12 text-danger"
        aria-hidden
      >
        <CategoryIcon icon="alert" size={36} />
      </div>
      <h2 className="text-xl font-semibold">Couldn&apos;t load this</h2>
      <p className="mt-1.5 max-w-xs text-label-2">
        {message || "Something went wrong."}
      </p>
      {onRetry ? (
        <Button variant="tinted" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
