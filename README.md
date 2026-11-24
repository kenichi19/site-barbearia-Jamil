# Barbearia Jamil — Protótipo

Site com estética **vintage requintada** e UX moderna, com agendamento online e painel do barbeiro.

## Como abrir
Não precisa instalar nada. Abra o `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## O que tem
- **`index.html`**: página inicial (apresentação, serviços, barbeiros, depoimentos, contato) e **agendamento em 4 passos**: serviço → barbeiro → data e horário → dados do cliente. Horários ocupados ou já passados aparecem bloqueados.
- **`admin.html`**: **área do barbeiro** com login. Mostra a agenda por dia e por barbeiro, com atendimentos e faturamento previsto, e permite **criar, editar, concluir, cancelar e excluir** agendamentos. Não deixa marcar dois clientes no mesmo horário.
  - Login de demonstração: `admin` / `jamil123`

## Como funciona (protótipo)
- Os dados ficam no `localStorage` do navegador (`js/store.js`). Cada navegador tem a sua própria agenda.
- Na primeira visita, alguns agendamentos de exemplo são criados. O botão **Restaurar demo** no painel volta ao estado inicial.
- Expediente configurado em `js/store.js` (`HOURS`): terça a sábado, das 9h às 19h, com horários a cada 30 min.
- Serviços, preços e barbeiros também ficam em `js/store.js`.

## Próximos passos sugeridos
1. Backend real (ex.: Supabase/Firebase ou API Node) para compartilhar a agenda entre clientes e barbeiros. Basta trocar as funções de `js/store.js`.
2. Autenticação segura no servidor (hoje o login é só ilustrativo).
3. Confirmação e lembrete por WhatsApp ou e-mail.
4. Logotipo e textos definitivos (endereço, telefone e história são fictícios).

## Fotos
As imagens ficam em `img/`:

| Arquivo | Onde aparece |
|---|---|
| `cortando.jpg` | Fundo do topo (`css/style.css`, `.hero-photo`) e galeria |
| `ambiente.jpg` | Seção "A Casa" |
| `pompadour.jpg`, `degrade.jpg` | Galeria |
| `poste.jpg` | Seção de contato |

Para trocar uma foto, envie com o mesmo nome de arquivo (substituindo a antiga).
