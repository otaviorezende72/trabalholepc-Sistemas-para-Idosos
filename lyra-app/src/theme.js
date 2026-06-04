// src/theme.js
export const CORES = {
  // Sua nova identidade
  primaria: '#67badd',       
  primariaEscura: '#0F52BA', 
  primariaClara: '#E8F5F2',  
  secundaria: '#F5F5F5',   
  
  // Base e Textos
  branco: '#FFFFFF',
  texto: '#1A212A',
  textoSecundario: '#8D9CAE',
  borda: '#E2E8F0',
  
  // Status (Mantidos para alertas e feedbacks)
  sucesso: '#10B981',
  sucessoClaro: '#D1FAE5',
  alerta: '#F59E0B',
  alertaClaro: '#FEF3C7',
  erro: '#EF4444',
  sos: '#EF4444',
};

export const SOMBRA = {
  pequena: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  media: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  grande: {
    shadowColor: '#EF4444', 
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  }
};