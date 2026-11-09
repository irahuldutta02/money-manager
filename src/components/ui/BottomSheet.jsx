"use client";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";
import { CloseIcon } from "@/components/icons";
import { useConfirm } from "@/components/ui/Confirm";

/**
 * Bottom sheet on a native <dialog>: focus trapping, Esc to close, inert
 * background and top-layer stacking come from the platform. We only add the
 * slide/fade animation (data-open toggles the CSS transition).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  subheader, // pinned under the title, outside the scrolling body
  tall = true,
  fixed = true, // false: size to content (only safe when nothing swaps in the footer)
  confirmClose = true, // false: no "discard changes?" prompt (non-form sheets)
  dirty, // forms that know their own state: true asks before closing (skips the text-diff guess)
  className,
}) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const baseline = useRef(null);
  const confirm = useConfirm();

  // What the user can see/edit in the body: text plus live field state.
  const snapshot = () => {
    const body = bodyRef.current;
    if (!body) return "";
    const fields = [...body.querySelectorAll("input, textarea, select")]
      .map((el) =>
        el.type === "file"
          ? el.files?.length
          : el.type === "checkbox" || el.type === "radio"
            ? el.checked
            : el.value,
      )
      .join("\u0001");
    const aria = [
      ...body.querySelectorAll("[aria-checked],[aria-pressed],[aria-selected]"),
    ]
      .map(
        (el) =>
          el.getAttribute("aria-checked") ??
          el.getAttribute("aria-pressed") ??
          el.getAttribute("aria-selected"),
      )
      .join(",");
    return `${body.innerText}\u0002${fields}\u0002${aria}`;
  };

  // Baseline is taken right before the user's first interaction, so data that
  // loads asynchronously after opening doesn't count as an edit.
  const markInteraction = (e) => {
    if (e.isTrusted && baseline.current === null) baseline.current = snapshot();
  };

  useEffect(() => {
    if (!open) baseline.current = null;
  }, [open]);

  const requestClose = async () => {
    const changed =
      dirty !== undefined
        ? dirty
        : baseline.current !== null && snapshot() !== baseline.current;
    if (confirmClose && changed) {
      const discard = await confirm({
        title: "Discard changes?",
        message:
          "Your changes haven't been saved and will be lost if you close.",
        confirmLabel: "Discard",
        cancelLabel: "Go back",
      });
      if (!discard) return;
    }
    onClose();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      // next frame so the closed->open transition actually runs
      const raf = requestAnimationFrame(() =>
        dialog.setAttribute("data-open", ""),
      );
      document.documentElement.style.overflow = "hidden";
      return () => {
        cancelAnimationFrame(raf);
        document.documentElement.style.overflow = "";
      };
    }
    dialog.removeAttribute("data-open");
    const t = setTimeout(() => dialog.open && dialog.close(), 280);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault(); // we close via state so the animation can play
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose(); // click on the backdrop
      }}
      className={cx(
        "glass-strong fixed m-0 overflow-hidden p-0",
        // phone: bottom sheet
        "inset-x-0 top-auto bottom-0 w-full max-h-[94dvh] flex-col rounded-t-sheet border-b-0",
        footer &&
          fixed &&
          (tall ? "h-[min(42rem,94dvh)]" : "h-[min(34rem,94dvh)]"),
        "translate-y-full transition-[transform,opacity] duration-300 ease-spring",
        "data-open:translate-y-0 open:flex",
        // tablet/desktop: centred glass modal
        footer && fixed
          ? tall
            ? "sm:h-[min(42rem,90dvh)]"
            : "sm:h-[min(34rem,90dvh)]"
          : "sm:h-fit",
        "sm:inset-0 sm:m-auto sm:max-h-[90dvh] sm:w-[34rem] sm:rounded-sheet sm:border-b",
        "sm:translate-y-6 sm:opacity-0 data-open:sm:translate-y-0 data-open:sm:opacity-100",
        "backdrop:bg-overlay backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-300",
        "data-open:backdrop:opacity-100",
        className,
      )}
    >
      <div
        className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-fill sm:hidden"
        aria-hidden
      />
      <header className="flex items-center justify-between px-4 pt-1 sm:pt-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-pill bg-fill text-label-2"
        >
          <CloseIcon />
        </button>
      </header>
      {subheader ? <div className="shrink-0 px-4 pt-3">{subheader}</div> : null}
      <div
        ref={bodyRef}
        onPointerDownCapture={markInteraction}
        onKeyDownCapture={markInteraction}
        onInputCapture={markInteraction}
        className={cx(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-3 [scrollbar-color:var(--label-2)_transparent] [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin]",
          // Content fades out under the header and above the footer instead
          // of being cut off abruptly while it scrolls.
          "[mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-separator px-4 pt-3 pb-safe">
          <div className="pb-3">{footer}</div>
        </div>
      ) : null}
    </dialog>
  );
}
