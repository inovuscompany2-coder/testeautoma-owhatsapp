-- Tabela para sessao do WhatsApp (apenas 1 conexao)
CREATE TABLE IF NOT EXISTS whatsapp_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  is_connected BOOLEAN DEFAULT false,
  session_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para fluxos de mensagens salvos
CREATE TABLE IF NOT EXISTS message_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  steps JSONB NOT NULL,
  contact_delay INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para historico de disparos
CREATE TABLE IF NOT EXISTS dispatch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES message_flows(id) ON DELETE SET NULL,
  flow_name TEXT,
  total_contacts INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para historico de envios por contato
CREATE TABLE IF NOT EXISTS sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES dispatch_history(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  flow_name TEXT,
  messages_sent INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  has_response BOOLEAN DEFAULT false,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para busca rapida por numero de telefone
CREATE INDEX IF NOT EXISTS idx_sent_messages_phone ON sent_messages(phone_number);

-- Indice para busca por status de resposta
CREATE INDEX IF NOT EXISTS idx_sent_messages_response ON sent_messages(has_response);

-- Funcao para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para whatsapp_session
DROP TRIGGER IF EXISTS update_whatsapp_session_updated_at ON whatsapp_session;
CREATE TRIGGER update_whatsapp_session_updated_at
    BEFORE UPDATE ON whatsapp_session
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para message_flows
DROP TRIGGER IF EXISTS update_message_flows_updated_at ON message_flows;
CREATE TRIGGER update_message_flows_updated_at
    BEFORE UPDATE ON message_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
