# Mescla — Editor e Mesclador de PDF

Este repositório contém um simples app front-end (HTML + JS) para mesclar, editar e organizar PDFs no cliente.

Pré-requisitos

- Nenhum backend necessário — a aplicação é totalmente estática.
- Para deploy no Vercel, você precisa de uma conta em https://vercel.com e do CLI opcional.

Deploy no Vercel (rápido)

1. Instale a Vercel CLI (opcional):

```powershell
npm i -g vercel
```

2. No diretório do projeto (onde está `pdf-editor.html`) execute:

```powershell
vercel login
vercel
```

3. Aceite as opções padrão. O Vercel detectará que o site é estático e fará o deploy.

Configuração recomendada

- O conteúdo estático (HTML/JS/CSS) pode ser enviado diretamente. O `vercel.json` incluído força o uso do builder estático.
O conteúdo estático (HTML/JS/CSS) pode ser enviado diretamente. O `vercel.json` incluído direciona a raiz do site para `pdf-editor.html`.

Observações

- Se você usa recursos externos (CDN), confirme que são acessíveis do ambiente Vercel.
- Se preferir servir a aplicação pela raiz `/`, mantenha `pdf-editor.html` ou renomeie-o para `index.html`.

Scripts úteis

Após instalar o Node/npm, você pode rodar localmente com:

```powershell
npm install
npm run start
```

E fazer deploy (precisa do Vercel CLI autenticado):

```powershell
npm run deploy
```

Se quiser, posso também criar um GitHub Action que faz o deploy automático ao enviar para `main`.
