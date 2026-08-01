import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Botón primario compartido por toda la app: mismo color, radio, tipografía y estados
 * (Guardar, Añadir, Confirmar…). Para variantes con icono, añade `flex items-center gap-2`
 * vía className. */
export default function Button({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-4 py-2.5 text-sm font-semibold text-app-bg bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

/** Botón secundario compartido (Cancelar y afines: descartar, ignorar…): mismo tamaño/radio
 * que Button, con borde neutro en vez de relleno. Rol de "acción menos definitiva" en un
 * footer de drawer - normalmente a la izquierda, junto al primario a la derecha. */
export function SecondaryButton({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-4 py-2.5 text-sm font-semibold text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

/** Botón de peligro compartido (Eliminar, dar de baja…): mismo tamaño/radio, borde y texto en
 * rojo. Para el aviso "Eliminar" con icono de papelera, usa DeleteButton. */
export function DangerButton({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-4 py-2.5 text-sm font-semibold text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

/** Variante sólida de DangerButton, para el clic de CONFIRMAR una acción destructiva (segundo
 * paso, después de que DeleteButton/DangerButton haya abierto la confirmación). */
export function DangerButtonSolid({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-4 py-2.5 text-sm font-semibold text-white bg-danger rounded-lg hover:bg-danger/85 transition-colors disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** El botón "Eliminar" estándar de todos los drawers de edición: DangerButton + icono de
 * papelera. Solo ABRE la confirmación - el clic que borra de verdad usa DangerButtonSolid. */
export function DeleteButton({ className = "", children = "Eliminar", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <DangerButton className={`flex items-center justify-center gap-1.5 ${className}`} {...props}>
      <TrashIcon />
      {children}
    </DangerButton>
  );
}
