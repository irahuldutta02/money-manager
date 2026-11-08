import { cx } from "@/lib/cx";

const control =
  "min-h-tap w-full rounded-control bg-fill px-3 text-base outline-none transition-colors duration-200 placeholder:text-label-2 focus:bg-accent-soft";

export function TextInput({ label, className, id, required, ...props }) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-0.5 block text-[0.8125rem] font-medium text-label-2"
      >
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      <input id={id} required={required} {...props} className={cx(control)} />
    </div>
  );
}
