# Roberto Souza Hair

Site público com agendamento online e painel administrativo.

## Estrutura

- \`public/index.html\`: página pública e formulário de agendamento.
- \`public/app.js\`: lógica do navegador para carregar serviços, dias e horários e enviar agendamentos.
- \`public/agenda.html\`: lista privada de marcações.
- \`public/painel.html\`: painel para editar serviços, fotos, horários e dias bloqueados.
- \`api/app.js\`: API serverless do agendamento.
- \`public/img/\`: fotos do site (serão adicionadas em uma etapa posterior).

## Rotas

| Link | Para quê |
|---|---|
| \`/\` | Site público e agendamento |
| \`/painel?k=CHAVE_DO_PAINEL\` | Editar serviços, fotos, dias, horários e datas bloqueadas |
| \`/agenda?k=CHAVE_DAS_MARCACOES\` | Ver marcações e cancelar horários |

## Configuração na Vercel

1. Importe este repositório na Vercel e configure a raiz do projeto como a raiz do repositório.
2. Mantenha o framework como **Other** e deixe o build command vazio, pois é um site estático com uma função serverless.
3. Instale/conecte o Vercel Blob no projeto.
4. Em **Settings → Environment Variables**, configure:
   - \`ADMIN_KEY\`: chave longa e privada para acessar o painel.
   - \`AGENDA_KEY\`: chave longa e privada para acessar a lista de marcações.
   - \`BLOB_READ_WRITE_TOKEN\`: token do Blob, normalmente disponibilizado pela integração.
5. Faça um novo deploy depois de salvar as variáveis.
6. Teste o agendamento completo antes de divulgar o endereço público.

Não coloque as chaves em arquivos versionados nem compartilhe os links privados do painel e da agenda.

## Observações

- Cada horário aceita apenas um agendamento; se duas pessoas tentarem reservar ao mesmo tempo, a API deve rejeitar a segunda tentativa.
- A API guarda configurações e marcações no Vercel Blob.
- As fotos ainda serão adicionadas depois; até lá, as áreas de imagem usam fundos de reserva.
