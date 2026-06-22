# SciTrack Alunos

Aplicação para acompanhar produção científica de alunos, com dashboard, Kanban, prazos, alertas, cadastro de artigos e persistência em PostgreSQL.

## Rodar com PostgreSQL

1. Suba o banco:

```powershell
docker compose up -d postgres
```

2. Instale as dependências do backend:

```powershell
python -m pip install -r backend/requirements.txt
```

3. Rode a API:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

4. Rode a interface:

```powershell
python -m http.server 8088 --bind 127.0.0.1
```

5. Acesse:

```text
http://127.0.0.1:8088/
```

## Banco

Configuração padrão:

```text
Host: 127.0.0.1
Porta: 5433
Banco: scitrack
Usuário: scitrack
Senha: scitrack
```

A API cria automaticamente as tabelas `articles` e `article_history` ao iniciar.

## Funcionalidades

- Dashboard com indicadores por status.
- Kanban por ciclo do artigo.
- Cadastro, edição, exclusão e avanço de status.
- Filtros por texto, status, aluno e período.
- Alertas de atraso e artigos sem atualização.
- Histórico básico de criação, atualização, mudança de status e exclusão.
- Exportação CSV dos artigos filtrados.

Se a API estiver desligada, a tela ainda abre, mas usa apenas o armazenamento local do navegador como fallback.
