-- ============================================
-- Migration: Multi-Tenant WhatsApp Sessions
-- ============================================

-- Altera a tabela whatsapp_session para suportar multi-tenant
-- Adiciona user_id para vincular sessoes a usuarios especificos

-- Adiciona coluna user_id se nao existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='whatsapp_session' AND column_name='user_id') THEN
        ALTER TABLE whatsapp_session ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Adiciona coluna status se nao existir (mais detalhado que is_connected)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='whatsapp_session' AND column_name='status') THEN
        ALTER TABLE whatsapp_session ADD COLUMN status TEXT DEFAULT 'disconnected';
    END IF;
END $$;

-- Adiciona coluna connected_at se nao existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='whatsapp_session' AND column_name='connected_at') THEN
        ALTER TABLE whatsapp_session ADD COLUMN connected_at TIMESTAMPTZ;
    END IF;
END $$;

-- Adiciona coluna disconnected_at se nao existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='whatsapp_session' AND column_name='disconnected_at') THEN
        ALTER TABLE whatsapp_session ADD COLUMN disconnected_at TIMESTAMPTZ;
    END IF;
END $$;

-- Adiciona coluna last_activity se nao existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='whatsapp_session' AND column_name='last_activity') THEN
        ALTER TABLE whatsapp_session ADD COLUMN last_activity TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Cria indice para user_id se nao existir
CREATE INDEX IF NOT EXISTS idx_whatsapp_session_user_id ON whatsapp_session(user_id);

-- Cria indice para status se nao existir
CREATE INDEX IF NOT EXISTS idx_whatsapp_session_status ON whatsapp_session(status);

-- ============================================
-- Tabela de Logs de Conexao
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES whatsapp_session(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL, -- 'qr_generated', 'connected', 'disconnected', 'auth_failure', 'reconnecting', 'message_received', 'message_sent'
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para logs
CREATE INDEX IF NOT EXISTS idx_connection_logs_session ON whatsapp_connection_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user ON whatsapp_connection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_event ON whatsapp_connection_logs(event);
CREATE INDEX IF NOT EXISTS idx_connection_logs_created ON whatsapp_connection_logs(created_at DESC);

-- ============================================
-- Tabela de Logs do Sistema
-- ============================================

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL, -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  source TEXT, -- 'whatsapp-service', 'api', 'frontend'
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para nivel de log
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Habilita RLS nas tabelas
ALTER TABLE whatsapp_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

-- Politica: usuarios so podem ver suas proprias sessoes
DROP POLICY IF EXISTS "Users can view own sessions" ON whatsapp_session;
CREATE POLICY "Users can view own sessions" ON whatsapp_session
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON whatsapp_session;
CREATE POLICY "Users can insert own sessions" ON whatsapp_session
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON whatsapp_session;
CREATE POLICY "Users can update own sessions" ON whatsapp_session
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON whatsapp_session;
CREATE POLICY "Users can delete own sessions" ON whatsapp_session
  FOR DELETE USING (auth.uid() = user_id);

-- Politica: usuarios so podem ver seus proprios logs
DROP POLICY IF EXISTS "Users can view own logs" ON whatsapp_connection_logs;
CREATE POLICY "Users can view own logs" ON whatsapp_connection_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON whatsapp_connection_logs;
CREATE POLICY "Users can insert own logs" ON whatsapp_connection_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Funcao para registrar log de conexao
-- ============================================

CREATE OR REPLACE FUNCTION log_whatsapp_event(
  p_session_id UUID,
  p_user_id UUID,
  p_event TEXT,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO whatsapp_connection_logs (
    session_id, user_id, event, details, ip_address, user_agent
  ) VALUES (
    p_session_id, p_user_id, p_event, p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Funcao para atualizar status da sessao
-- ============================================

CREATE OR REPLACE FUNCTION update_session_status(
  p_session_id UUID,
  p_status TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_session
  SET 
    status = p_status,
    phone = COALESCE(p_phone, phone),
    is_connected = (p_status = 'connected'),
    connected_at = CASE WHEN p_status = 'connected' THEN NOW() ELSE connected_at END,
    disconnected_at = CASE WHEN p_status = 'disconnected' THEN NOW() ELSE disconnected_at END,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;
