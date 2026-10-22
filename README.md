# Roberto Souza Hair

Site de agendamento com 3 links:

| Link | Endereço | Para quê |
|---|---|---|
| Cliente | `/` | Site público e agendamento |
| Painel | `/painel?k=CHAVE_DO_PAINEL` | Editar serviços, fotos, dias, horários e datas bloqueadas |
| Marcações | `/agenda?k=CHAVE_DAS_MARCACOES` | Ver quem agendou e cancelar horários |

## Como funciona
- `public/` guarda as páginas e as fotos (`public/img`).
- `api/app.js` é a única função do servidor. Guarda tudo no Vercel Blob.
- Cada horário reservado vira um arquivo `slots/DATA_HORA.json` criado sem sobrescrever. Se já existe, o horário já é de outra pessoa (um cliente por horário).
- Não existe nenhum valor (preço) no site.

## Variáveis de ambiente (Vercel > Settings > Environment Variables)
- `ADMIN_KEY`: chave do painel de edição.
- `AGENDA_KEY`: chave da página de marcações.
- `BLOB_READ_WRITE_TOKEN`: criada automaticamente ao conectar o Blob (Storage).
