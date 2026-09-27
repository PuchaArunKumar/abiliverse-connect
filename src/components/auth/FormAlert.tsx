interface FormAlertProps {
  message: string | null;
  id?: string;
}

/**
 * A form-level error that stays on screen and is announced when it appears.
 * Toasts vanish after a few seconds, which is too quick for many people to
 * read; a sign-in failure needs to still be there when they look for it.
 */
const FormAlert = ({ message, id }: FormAlertProps) =>
  message ? (
    <p
      id={id}
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive [overflow-wrap:anywhere]"
    >
      {message}
    </p>
  ) : null;

export default FormAlert;
