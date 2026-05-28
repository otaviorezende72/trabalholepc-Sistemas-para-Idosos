// Paleta de cores do Lyra — baseada no design verde escuro
export const CORES = {
  primaria: '#0D6E5E',       // verde escuro principal
  primariaEscura: '#094E43', // hover/pressed
  primariaClara: '#E8F5F2',  // backgrounds suaves
  secundaria: '#F5F5F5',     // fundo geral
  branco: '#FFFFFF',
  texto: '#1A1A1A',
  textoSecundario: '#6B7280',
  borda: '#E5E7EB',
  erro: '#DC2626',
  erroClaro: '#FEE2E2',
  sucesso: '#16A34A',
  sucessoClaro: '#DCFCE7',
  alerta: '#D97706',
  alertaClaro: '#FEF3C7',
  sos: '#DC2626',
};

export const SOMBRA = {
  pequena: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  media: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  grande: {
    shadowColor: '#0D6E5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
};
