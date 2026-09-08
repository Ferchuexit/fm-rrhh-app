// FM RRHH — app/LogoFM.tsx
// Logo original para "FM Software" — inspirado en la paleta e íconos del
// logo de FM Consultora RRHH (documento + check), pero un diseño propio,
// no una copia. El logo de la consultora es para los clientes; este es
// para el software interno.
export default function LogoFM({ height = 32 }: { height?: number }) {
  return (
    <svg height={height} viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FM Software">
      {/* Ícono: documento con check, mismo lenguaje visual que el logo de la consultora */}
      <rect x="2" y="8" width="30" height="40" rx="3" fill="none" stroke="#163A5C" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="24" y2="18" stroke="#7FA8C6" strokeWidth="2" />
      <line x1="8" y1="24" x2="24" y2="24" stroke="#7FA8C6" strokeWidth="2" />
      <line x1="8" y1="30" x2="18" y2="30" stroke="#7FA8C6" strokeWidth="2" />
      <circle cx="26" cy="42" r="12" fill="#7FA8C6" />
      <path d="M 20 42 L 24.5 47 L 33 37" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Wordmark */}
      <text x="44" y="38" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="26" fill="#163A5C">
        FM
      </text>
      <text x="90" y="38" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="26" fill="#7FA8C6">
        Software
      </text>
    </svg>
  );
}
