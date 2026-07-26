import type { ReactNode } from "react";

type PageTitleProps = {
  icon: string;
  children: ReactNode;
};

export function PageTitle({ icon, children }: PageTitleProps) {
  return (
    <h1 className="zm-page-title">
      <img src={icon} alt="" className="zm-page-title-icon" aria-hidden />
      {children}
    </h1>
  );
}

type EditIconButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
};

export function EditIconButton({
  label,
  onClick,
  className = "",
  disabled,
}: EditIconButtonProps) {
  return (
    <button
      type="button"
      className={`zm-btn zm-btn-ghost zm-btn-icon${className ? ` ${className}` : ""}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <img src="/design/Edit.svg" alt="" className="zm-edit-icon" aria-hidden />
    </button>
  );
}

type CloseIconButtonProps = {
  label?: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
};

export function CloseIconButton({
  label = "Schließen",
  onClick,
  className = "",
  disabled,
}: CloseIconButtonProps) {
  return (
    <button
      type="button"
      className={`zm-btn zm-btn-ghost zm-btn-icon zm-btn-close${className ? ` ${className}` : ""}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <img src="/design/Close.svg" alt="" className="zm-close-icon" aria-hidden />
    </button>
  );
}
