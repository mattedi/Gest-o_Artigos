# SciTrack Alunos

SciTrack Alunos é uma aplicação web para acompanhar a produção científica de alunos e orientandos. A ideia central é tratar cada artigo como um processo acompanhado por status, prazos, responsáveis, histórico e próximas ações.

O sistema foi pensado para uso por orientadores, grupos de pesquisa, laboratórios e programas que precisam monitorar artigos desde a ideia inicial até submissão, aceite e publicação.

## Principais Recursos

- Dashboard com indicadores por status.
- Pipeline/Kanban do ciclo do artigo.
- Cadastro, edição, exclusão e avanço de status.
- Controle de prazo e próxima ação.
- Alertas para artigos atrasados ou sem atualização.
- Lista de artigos com filtros por texto, status, aluno e período.
- Síntese operacional para apoiar o acompanhamento.
- Exportação CSV dos artigos filtrados.
- Persistência em PostgreSQL.
- Histórico básico de eventos em `article_history`.
- Fallback local no navegador caso a API esteja indisponível.

## Arquitetura

```text
Navegador
  |
  |  HTML/CSS/JavaScript
  v
Frontend estático
  |
  |  REST API
  v
FastAPI
  |
  |  SQLAlchemy + psycopg
  v
PostgreSQL
```

## Estrutura do Projeto

```text
.
├── backend/
│   ├── main.py              # API FastAPI e modelos SQLAlchemy
│   └── requirements.txt     # Dependências Python
├── app.js                   # Lógica do frontend
├── docker-compose.yml       # Serviço PostgreSQL local
├── index.html               # Interface principal
├── styles.css               # Layout e identidade visual
├── README.md                # Documentação
└── .gitignore               # Arquivos ignorados pelo Git
```

## Pré-Requisitos

- Python 3.12 ou superior.
- Docker Desktop.
- Navegador moderno.
- Git, caso queira versionar ou publicar alterações.

## Execução Local

### 1. Subir o PostgreSQL

```powershell
docker compose up -d postgres
```

Verifique se o container está rodando:

```powershell
docker compose ps
```

### 2. Instalar dependências do backend

```powershell
python -m pip install -r backend/requirements.txt
```

### 3. Rodar a API

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

Teste a API:

```text
http://127.0.0.1:8090/api/health
```

Resposta esperada:

```json
{"status":"ok"}
```

### 4. Rodar a interface

Em outro terminal:

```powershell
python -m http.server 8088 --bind 127.0.0.1
```

Acesse:

```text
http://127.0.0.1:8088/
```

## Configuração do Banco

Configuração padrão definida em `docker-compose.yml`:

```text
Host: 127.0.0.1
Porta: 5433
Banco: scitrack
Usuário: scitrack
Senha: scitrack
```

A variável padrão usada pelo backend é:

```text
postgresql+psycopg://scitrack:scitrack@127.0.0.1:5433/scitrack
```

Se quiser usar outro banco, defina `DATABASE_URL` antes de iniciar a API:

```powershell
$env:DATABASE_URL="postgresql+psycopg://usuario:senha@host:porta/banco"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

## Tabelas Criadas

A API cria automaticamente as tabelas ao iniciar.

### `articles`

Armazena os artigos acompanhados:

- `id`
- `title`
- `student`
- `course`
- `level`
- `area`
- `type`
- `status`
- `next_action`
- `deadline`
- `venue`
- `notes`
- `last_update`
- `created_at`
- `updated_at`

### `article_history`

Registra eventos básicos:

- criação de artigo
- atualização
- mudança de status
- marcação de atualização
- exclusão

## Endpoints da API

### Saúde

```http
GET /api/health
```

### Listar artigos

```http
GET /api/articles
```

### Criar artigo

```http
POST /api/articles
```

Exemplo de corpo:

```json
{
  "title": "Título do artigo",
  "student": "Nome do aluno",
  "course": "Programa ou curso",
  "level": "Mestrado",
  "area": "Sociologia da Ciência",
  "type": "Artigo",
  "status": "Projetado",
  "nextAction": "Revisar problema de pesquisa",
  "deadline": "2026-07-15",
  "venue": "Revista alvo",
  "notes": "Observações gerais",
  "lastUpdate": "2026-06-22"
}
```

### Atualizar artigo

```http
PUT /api/articles/{article_id}
```

### Atualizar status

```http
PATCH /api/articles/{article_id}/status
```

Corpo:

```json
{
  "status": "Em desenvolvimento"
}
```

### Marcar atualização

```http
PATCH /api/articles/{article_id}/touch
```

### Excluir artigo

```http
DELETE /api/articles/{article_id}
```

## Fluxo de Status

O fluxo principal da aplicação é:

```text
Projetado
→ Em desenvolvimento
→ Em revisão
→ Concluído
→ Encaminhado
→ Aceito
→ Publicado
```

## Como Usar

1. Abra a aplicação no navegador.
2. Clique em `+ Novo artigo`.
3. Preencha título, aluno, área, status, prazo e próxima ação.
4. Salve o artigo.
5. Use o painel para acompanhar prazos e riscos.
6. Use `Avançar` para mover o artigo para a próxima etapa.
7. Use `Marcar atualização` quando houver reunião, revisão ou nova versão.
8. Use filtros para localizar artigos por aluno, status ou período.

## Persistência e Fallback

Quando a API está ativa, os dados são salvos no PostgreSQL.

Se a API estiver desligada, a interface ainda abre e usa `localStorage` como fallback. Esse fallback é útil para evitar perda imediata de trabalho, mas não substitui o banco:

- fica apenas no navegador atual;
- não é compartilhado;
- pode ser perdido ao limpar dados do navegador;
- não deve ser usado como fonte principal.

## Dados Sensíveis

O arquivo `cadastro_artigos_orientandos.xlsx` foi incluído no `.gitignore` para evitar publicar dados de alunos por acidente.

Antes de subir novos arquivos ao GitHub, verifique se não há:

- nomes, e-mails ou dados pessoais não autorizados;
- planilhas com dados de orientandos;
- chaves de API;
- arquivos `.env`;
- dumps de banco.

## Solução de Problemas

### A tela abre, mas os artigos não salvam no banco

Verifique se a API está ativa:

```text
http://127.0.0.1:8090/api/health
```

Se não responder, inicie:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

### A API não conecta no PostgreSQL

Confirme se o container está rodando:

```powershell
docker compose ps
```

Se necessário, suba novamente:

```powershell
docker compose up -d postgres
```

### A interface parece antiga ou com layout quebrado

Use recarregamento forçado no navegador:

```text
Ctrl + F5
```

### Porta ocupada

Use outra porta para o servidor estático:

```powershell
python -m http.server 8091 --bind 127.0.0.1
```

Depois acesse:

```text
http://127.0.0.1:8091/
```

## Publicação no GitHub

O repositório remoto configurado é:

```text
https://github.com/mattedi/Gest-o_Artigos.git
```

Fluxo básico:

```powershell
git status
git add .
git commit -m "Mensagem do commit"
git push
```

## Próximos Passos Recomendados

- Adicionar autenticação de usuários.
- Separar cadastro de alunos em tabela própria.
- Criar tela específica para histórico do artigo.
- Adicionar anexos ou links para Google Docs/PDF.
- Criar relatório mensal por orientador ou grupo.
- Adicionar backup/exportação do PostgreSQL.
- Evoluir a síntese operacional para uma camada real de IA.
