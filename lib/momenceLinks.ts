// hostId de Aura en Momence (no es secreto: aparece en cada URL del panel).
const MOMENCE_HOST_ID = 159600;

// URL de la ficha de un cliente en el panel de Momence (CRM). El customerId del
// panel coincide con el member_id que devuelve la API v2 (verificado 2026-07-30).
export function momenceCustomerUrl(memberId: number): string {
  return `https://momence.com/dashboard/${MOMENCE_HOST_ID}/crm/${memberId}`;
}
